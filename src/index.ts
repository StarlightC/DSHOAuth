import type { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle, ConnectionRpcHandlerResult } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import { OAuthCoordinator, isProviderId } from './flow.js'
export { OAuthCoordinator } from './flow.js'

export const name = 'dsh-oauth'
export const inject = ['credentials']

function payloadObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request')
  return value as Record<string, unknown>
}
function string(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > 8192) throw new Error(`Invalid ${label}`)
  return value
}

export const endpoints = ['status', 'begin', 'answer', 'cancel', 'logout'] as const

/** The host authenticates these exact routes before dispatching. */
export function registerRoutes(connection: HostConnectionHandle, coordinator: OAuthCoordinator) {
  return endpoints.map(operation => {
    const endpoint = `dsh-oauth.${operation}`
    return connection.fetch.register({
      path: `/api/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        let envelope: Record<string, unknown>
        try {
          envelope = payloadObject(await request.json())
          if (envelope.type !== 'client-request' || envelope.method !== endpoint) throw new Error('Invalid envelope')
          string(envelope.rpcId, 'rpcId')
        } catch { return new Response('Invalid RPC request', { status: 400 }) }
        let result: ConnectionRpcHandlerResult
        try {
          const input = payloadObject(envelope.payload)
          const provider = input.provider
          if (!isProviderId(provider)) throw new Error('Unsupported provider')
          let value: unknown
          switch (operation) {
            case 'status': value = await coordinator.status(provider); break
            case 'begin': value = coordinator.begin(provider); break
            case 'answer':
              coordinator.answer(provider, string(input.id, 'attempt'),
                string(input.promptId, 'prompt'), string(input.value, 'answer', true))
              value = true; break
            case 'cancel':
              coordinator.cancel(provider, string(input.id, 'attempt'))
              value = true; break
            case 'logout': await coordinator.logout(provider); value = true; break
          }
          result = { ok: true, value }
        } catch (error) {
          result = { ok: false, error: { code: 'dsh-oauth/request',
            message: error instanceof Error ? error.message : String(error), details: {} } }
        }
        return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result })
      },
    })
  })
}

export function apply(ctx: Context): void {
  const coordinator = new OAuthCoordinator(ctx.credentials)
  ctx.effect(() => () => coordinator.close(), 'dsh-oauth: stop login attempts')
  ctx.inject(['connection'], connected => {
    const connection = connected.get('connection') as HostConnectionHandle
    registerRoutes(connection, coordinator)
  })
}
