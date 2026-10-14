import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

function localeFixture() {
  const dictionaries = {}
  return {
    register(_namespace, language, value) { dictionaries[language] = value; return () => {} },
    bind() { return key => dictionaries.en[key] },
  }
}

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
  client.apply({ locale: localeFixture(), effect(fn) { fn() }, get(name) { return name === 'slots' ? slots : { rpc: {} } } })
  assert.equal(slot.options.key, 'llm-pi-ai')
  assert.equal(slot.options.name, 'settings.models.provider-card')
  assert.equal(typeof slot.component, 'function')
})

async function clientFixture(rpc, navigator = {}) {
  const React = await import('react')
  const { create, act } = await import('react-test-renderer')
  let definition, component, injected
  const timers = new Map()
  let serial = 0
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    AbortController, navigator,
    setTimeout(fn) { const id = ++serial; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  definition.factory(createRequire(import.meta.url)).apply({ locale: localeFixture(), effect(fn) { fn() }, get(name) {
    return name === 'slots' ? {
      inject(_name, register) { register() },
      register(options, value) { component = value; injected = options.inject() },
    } : { rpc }
  } })
  let root
  const element = provider => React.createElement(component, { provider: { provider }, ...injected })
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
    const cancel = root.root.findAllByType('button').find(button => button.children.includes('Cancel'))
    await act(async () => cancel.props.onClick())
    assert.equal(pollSignal.aborted, true)
    await act(async () => resolveOld({ ok: true, value: waiting }))
    assert.equal(root.root.findAllByType('input').length, 0)
    await act(async () => root.update(element('openai-codex')))
    assert.equal(root.root.findAllByType('input').length, 0)
    assert.ok(root.root.findAllByType('button').some(button => button.children.includes('Sign in')))
  } finally { await act(async () => root.unmount()) }
})


test('copy failure stays in the authorization panel without starting a credential mutation', async () => {
  const calls = []
  const state = { configured: false, writable: true, attempt: {
    id: 'copy-test', phase: 'waiting', notice: { message: 'Authorize in browser', code: 'ABCD-EFGH' },
  } }
  const { root, act } = await clientFixture({ async call(_channel, method) {
    calls.push(method)
    return { ok: true, value: state }
  } }, { clipboard: { async writeText() { throw new Error('Clipboard unavailable') } } })
  try {
    await act(async () => root.root.findAllByType('button').find(button => button.children.includes('Copy')).props.onClick())
    assert.match(root.root.findByProps({ role: 'alert' }).children.join(''), /copy it manually/)
    assert.equal(root.root.findByType('code').children.join(''), 'ABCD-EFGH')
    assert.ok(calls.every(method => method.endsWith('.status')))
  } finally { await act(async () => root.unmount()) }
})

test('finalizing hides stale authorization controls and read-only credentials have no actions', async () => {
  let state = { configured: true, writable: true, attempt: {
    id: 'final', phase: 'finalizing', notice: { message: 'Old notice', code: 'ABCD-EFGH' },
    prompt: { id: 'old', type: 'text', message: 'Old prompt' },
  } }
  const { root, act, element } = await clientFixture({ async call() { return { ok: true, value: state } } })
  try {
    assert.match(root.root.findByProps({ role: 'status' }).findAllByType('span').at(-1).children.join(''), /Finishing sign-in/)
    assert.equal(root.root.findAllByType('button').length, 0)
    assert.equal(root.root.findAllByType('input').length, 0)
    state = { configured: true, writable: false }
    await act(async () => root.update(element('openai-codex')))
    assert.equal(root.root.findAllByType('button').length, 0)
    assert.ok(root.root.findAllByType('p').some(p => p.children.includes('This credential is read-only.')))
  } finally { await act(async () => root.unmount()) }
})
