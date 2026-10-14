import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OAuthCoordinator } from '../lib/index.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function fixture(store, login) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-oauth-test-'))
  const coordinator = new OAuthCoordinator(store, home, login)
  return { coordinator, cleanup: async () => { await coordinator.close(); await rm(home, { recursive: true, force: true }) } }
}
async function until(coordinator, phase, provider = 'openai-codex') {
  for (let i = 0; i < 100; i++) {
    const status = await coordinator.status(provider)
    if (status.attempt?.phase === phase) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`attempt did not reach ${phase}`)
}
const grant = { type: 'oauth', access: 'secret', refresh: 'refresh-secret' }

test('cancellation while the official record write is queued skips the grant', async () => {
  const gate = deferred()
  const entered = deferred()
  let stored
  const store = {
    async describeRecord() { return { configured: stored !== undefined, kind: stored?.kind, writable: true } },
    async modifyRecord(_key, mutate) {
      entered.resolve()
      await gate.promise
      const next = await mutate(stored)
      if (next !== undefined) stored = next
      return stored
    },
    async deleteRecord() { stored = undefined },
  }
  const { coordinator, cleanup } = await fixture(store, async () => grant)
  try {
    const owner = coordinator.begin('openai-codex')
    await entered.promise
    coordinator.cancel('openai-codex', owner.id)
    gate.resolve()
    await until(coordinator, 'cancelled')
    assert.equal(stored, undefined)
  } finally { await cleanup() }
})

test('accepted commit cannot be cancelled; logout waits for the official write', async () => {
  const gate = deferred()
  const entered = deferred()
  let stored
  const store = {
    async describeRecord() { return { configured: stored !== undefined, kind: stored?.kind, writable: true } },
    async modifyRecord(_key, mutate) {
      const next = await mutate(stored)
      entered.resolve()
      await gate.promise
      if (next !== undefined) stored = next
      return stored
    },
    async deleteRecord() { stored = undefined },
  }
  const { coordinator, cleanup } = await fixture(store, async () => grant)
  try {
    const owner = coordinator.begin('openai-codex')
    await entered.promise
    assert.throws(() => coordinator.cancel('openai-codex', owner.id), /commit has already started/)
    gate.resolve()
    await until(coordinator, 'complete')
    assert.equal(stored.kind, 'grant')
    await coordinator.logout('openai-codex')
    assert.equal(stored, undefined)
  } finally { await cleanup() }
})

test('one attempt per provider, attempt-bound prompt, and official grant record', async () => {
  let stored
  const store = {
    async describeRecord() { return { configured: stored !== undefined, kind: stored?.kind, writable: true } },
    async modifyRecord(_key, mutate) { const next = await mutate(stored); if (next !== undefined) stored = next; return stored },
    async deleteRecord() { stored = undefined },
  }
  const { coordinator, cleanup } = await fixture(store, async (_provider, interaction) => {
    const answer = await interaction.prompt({ type: 'select', message: 'Method?', options: [
      { id: 'device', label: 'Device code' },
    ] })
    assert.equal(answer, 'device')
    return grant
  })
  try {
    const owner = coordinator.begin('openai-codex')
    assert.throws(() => coordinator.begin('openai-codex'), /already in progress/)
    await until(coordinator, 'waiting')
    const { attempt } = await coordinator.status('openai-codex')
    assert.throws(() => coordinator.answer('openai-codex', 'wrong', attempt.prompt.id, 'device'), /not found/)
    assert.throws(() => coordinator.answer('openai-codex', owner.id, attempt.prompt.id, 'invalid'), /Invalid option/)
    coordinator.answer('openai-codex', owner.id, attempt.prompt.id, 'device')
    await until(coordinator, 'complete')
    assert.deepEqual(stored, { kind: 'grant', payload: grant })
    await coordinator.logout('openai-codex')
    assert.equal(stored, undefined)
  } finally { await cleanup() }
})

test('cancelled re-login leaves the previous official grant intact', async () => {
  const gate = deferred()
  const entered = deferred()
  const original = { kind: 'grant', payload: { type: 'oauth', access: 'old', refresh: 'old-refresh', expires: 100 } }
  let stored = original
  const store = {
    async describeRecord() { return { configured: true, kind: stored.kind, writable: true } },
    async modifyRecord(_key, mutate) {
      entered.resolve()
      await gate.promise
      const next = await mutate(stored)
      if (next !== undefined) stored = next
      return stored
    },
    async deleteRecord() { stored = undefined },
  }
  const { coordinator, cleanup } = await fixture(store, async () => grant)
  try {
    const owner = coordinator.begin('openai-codex')
    await entered.promise
    coordinator.cancel('openai-codex', owner.id)
    gate.resolve()
    await until(coordinator, 'cancelled')
    assert.deepEqual(stored, original)
  } finally { await cleanup() }
})

test('logout aborts a pending prompt and removes only the official record', async () => {
  let stored = { kind: 'grant', payload: grant }
  const store = {
    async describeRecord() { return { configured: stored !== undefined, kind: stored?.kind, writable: true } },
    async modifyRecord(_key, mutate) { const next = await mutate(stored); if (next !== undefined) stored = next; return stored },
    async deleteRecord() { stored = undefined },
  }
  const { coordinator, cleanup } = await fixture(store, async (_provider, interaction) => {
    await interaction.prompt({ type: 'manual_code', message: 'Paste code' })
    return grant
  })
  try {
    const owner = coordinator.begin('openai-codex')
    await until(coordinator, 'waiting')
    const { attempt } = await coordinator.status('openai-codex')
    await coordinator.logout('openai-codex')
    assert.equal(stored, undefined)
    assert.throws(() => coordinator.answer('openai-codex', owner.id, attempt.prompt.id, 'late'),
      /no longer active/)
  } finally { await cleanup() }
})

function memoryStore() {
  return {
    record: undefined,
    async describeRecord() { return { configured: !!this.record, kind: this.record?.kind, writable: true } },
    async modifyRecord(_key, mutate) { const next = await mutate(this.record); if (next !== undefined) this.record = next; return this.record },
    async deleteRecord() { this.record = undefined },
  }
}

test('close waits for logout deletion and rejects new mutations', async () => {
  const entered = deferred(), gate = deferred()
  const store = memoryStore()
  store.deleteRecord = async () => { entered.resolve(); await gate.promise }
  const { coordinator, cleanup } = await fixture(store, async () => grant)
  try {
    const logout = coordinator.logout('openai-codex')
    assert.throws(() => coordinator.begin('openai-codex'), /Logout in progress/)
    assert.equal(coordinator.logout('openai-codex'), logout)
    await entered.promise
    let closed = false
    const closing = coordinator.close().then(() => { closed = true })
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(closed, false)
    assert.throws(() => coordinator.begin('openai-codex'), /stopping/)
    await assert.rejects(coordinator.logout('openai-codex'), /stopping/)
    gate.resolve()
    await Promise.all([logout, closing])
  } finally { gate.resolve(); await cleanup() }
})

test('expiry aborts OAuth but retains the operation until the raw flow settles', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-oauth-expiry-'))
  const aborted = deferred(), settle = deferred()
  const store = memoryStore()
  const coordinator = new OAuthCoordinator(store, home, async (_provider, { signal }) => {
    signal.addEventListener('abort', () => aborted.resolve(), { once: true })
    await settle.promise
    return grant
  }, 100)
  try {
    coordinator.begin('openai-codex')
    await aborted.promise
    assert.equal((await coordinator.status('openai-codex')).attempt.phase, 'cancelling')
    assert.throws(() => coordinator.begin('openai-codex'), /already in progress/)
    settle.resolve()
    await until(coordinator, 'error')
    assert.match((await coordinator.status('openai-codex')).attempt.error, /timed out/)
    assert.equal(store.record, undefined)
  } finally { settle.resolve(); await coordinator.close(); await rm(home, { recursive: true, force: true }) }
})

test('prompt IDs reject stale and invalid answers, but empty text is passed through', async () => {
  const store = memoryStore()
  const { coordinator, cleanup } = await fixture(store, async (_provider, { prompt }) => {
    assert.equal(await prompt({ type: 'text', message: 'Blank for github.com' }), '')
    return grant
  })
  try {
    coordinator.begin('openai-codex') // Even if begin response is lost, status recovers controls.
    await until(coordinator, 'waiting')
    const { attempt } = await coordinator.status('openai-codex')
    assert.throws(() => coordinator.answer('openai-codex', attempt.id, 'stale', ''), /no longer active/)
    coordinator.answer('openai-codex', attempt.id, attempt.prompt.id, '')
    await until(coordinator, 'complete')
  } finally { await cleanup() }
})

test('the actual official Copilot flow accepts blank github.com and honours cancellation', async t => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    assert.equal(String(url), 'https://github.com/login/device/code')
    return Response.json({ device_code: 'device-test', user_code: 'USER-TEST', verification_uri: 'https://github.com/login/device', expires_in: 600, interval: 30 })
  })
  const store = memoryStore()
  const { coordinator, cleanup } = await fixture(store, undefined)
  try {
    coordinator.begin('github-copilot')
    await until(coordinator, 'waiting', 'github-copilot')
    const { attempt } = await coordinator.status('github-copilot')
    assert.match(attempt.prompt.message, /blank for github.com/)
    coordinator.answer('github-copilot', attempt.id, attempt.prompt.id, '')
    for (let i = 0; i < 100; i++) {
      if ((await coordinator.status('github-copilot')).attempt.notice?.code) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    assert.equal((await coordinator.status('github-copilot')).attempt.notice.code, 'USER-TEST')
    coordinator.cancel('github-copilot', attempt.id)
    await until(coordinator, 'cancelled', 'github-copilot')
    assert.equal(urls.length, 1)
    assert.equal(store.record, undefined)
  } finally { await cleanup() }
})
