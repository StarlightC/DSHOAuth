import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { registerRoutes } from '../lib/index.js'

test('exact routes coexist with the official shared-channel interceptor and preserve RPC envelopes', async () => {
  const host = new HostConnectionService(new Context(), [], {})
  const gateway = host.rpc.intercept('/api', () => true, async () => ({ ok: true, value: 'gateway' }))
  const answers = []
  const routes = registerRoutes(host, {
    status: async () => ({ configured: false, writable: true }),
    answer: (...args) => answers.push(args),
  })
  const handler = host.createSharedFetchHandler('/api')
  const post = (operation, overrides = {}) => handler.fetch(new Request(`http://localhost/api/dsh-oauth.${operation}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test-id', method: `dsh-oauth.${operation}`,
      payload: { provider: 'github-copilot', id: 'attempt', promptId: 'prompt', value: '' }, ...overrides }),
  }))
  try {
    assert.deepEqual(await (await post('status')).json(), { type: 'server-response', rpcId: 'test-id',
      result: { ok: true, value: { configured: false, writable: true } } })
    assert.equal((await (await post('answer')).json()).result.ok, true)
    assert.deepEqual(answers, [['github-copilot', 'attempt', 'prompt', '']])
    assert.equal((await post('answer', { method: 'dsh-oauth.logout' })).status, 400)
    assert.equal((await post('status', { type: 'wrong' })).status, 400)
    assert.equal((await (await post('status', { payload: { provider: 'unknown' } })).json()).result.ok, false)
    const fallback = await handler.fetch(new Request('http://localhost/api/official.method', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'fallback', method: 'official.method', payload: {} }),
    }))
    assert.equal((await fallback.json()).result.value, 'gateway')
  } finally {
    for (const dispose of routes) await dispose()
    await gateway()
    await host.operator.dispose()
  }
})
