import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

test('the browser bundle registers one official provider-card extension', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let definition
  const window = { __ModuleLoader__: { load(value) { definition = value } } }
  vm.runInNewContext(source, { window })
  assert.equal(definition.id, 'dsh-oauth')
  const client = definition.factory(createRequire(import.meta.url))
  let slot
  const slots = {
    inject(name, register) { assert.equal(name, 'settings.models.provider-card'); register() },
    register(options, component) { slot = { options, component }; return () => {} },
  }
  client.apply({ get(name) { return name === 'slots' ? slots : { rpc: {} } } })
  assert.equal(slot.options.key, 'llm-pi-ai')
  assert.equal(slot.options.name, 'settings.models.provider-card')
  assert.equal(typeof slot.component, 'function')
})

async function clientFixture(rpc) {
  const React = await import('react')
  const { create, act } = await import('react-test-renderer')
  let definition, component
  const timers = new Map()
  let serial = 0
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    AbortController,
    setTimeout(fn) { const id = ++serial; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  definition.factory(createRequire(import.meta.url)).apply({ get(name) {
    return name === 'slots' ? {
      inject(_name, register) { register() },
      register(_options, value) { component = value },
    } : { rpc }
  } })
  let root
  const element = provider => React.createElement(component, { provider: { provider }, rpc })
  await act(async () => { root = create(element('github-copilot')) })
  return { root, act, element, timers }
}
const waiting = { configured: false, writable: true, attempt: {
  id: 'recoverable', phase: 'waiting', prompt: { id: 'prompt-1', type: 'text', message: 'Blank for github.com' },
} }

test('a fresh client can submit the official blank default and recover controls without session storage', async () => {
  const calls = []
  let state = waiting
  const rpc = { async call(_channel, method, payload) {
    calls.push({ method, payload })
    if (method.endsWith('.answer')) state = { configured: true, writable: true, attempt: { id: 'recoverable', phase: 'complete' } }
    return { ok: true, value: method.endsWith('.status') ? state : true }
  } }
  const { root, act } = await clientFixture(rpc)
  try {
    assert.equal(root.root.findByType('input').props.value, '')
    assert.equal(root.root.findAllByType('button').find(button => button.props.type === 'submit').props.disabled, false)
    await act(async () => { root.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    const answer = calls.find(call => call.method.endsWith('.answer'))
    assert.equal(answer.payload.value, '')
    assert.equal(answer.payload.id, 'recoverable')
    assert.equal(root.root.findAllByType('input').length, 0)
  } finally { await act(async () => root.unmount()) }
})

test('a late poll cannot replace post-cancel state, and changing provider clears prompt state', async () => {
  let resolveOld, pollSignal, count = 0, cancelled = false
  const rpc = { async call(_channel, method, payload, signal) {
    if (method.endsWith('.cancel')) { cancelled = true; return { ok: true, value: true } }
    if (payload.provider === 'openai-codex') return { ok: true, value: { configured: false, writable: true } }
    if (++count === 2) {
      pollSignal = signal
      return new Promise(resolve => { resolveOld = resolve })
    }
    return { ok: true, value: cancelled ? { configured: false, writable: true, attempt: { id: 'recoverable', phase: 'cancelled' } } : waiting }
  } }
  const { root, act, timers, element } = await clientFixture(rpc)
  try {
    await act(async () => { root.root.findByType('input').props.onChange({ target: { value: 'old text' } }) })
    await act(async () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn() })
    const cancel = root.root.findAllByType('button').find(button => button.children.includes('取消 / Cancel'))
    await act(async () => cancel.props.onClick())
    assert.equal(pollSignal.aborted, true)
    await act(async () => resolveOld({ ok: true, value: waiting }))
    assert.equal(root.root.findAllByType('input').length, 0)
    await act(async () => root.update(element('openai-codex')))
    assert.equal(root.root.findAllByType('input').length, 0)
    assert.ok(root.root.findAllByType('button').some(button => button.children.includes('登录 / Sign in')))
  } finally { await act(async () => root.unmount()) }
})
