import { useCallback, useEffect, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { PublicAttempt, ProviderId } from './flow.js'

export const name = 'dsh-oauth/client'
export const inject = ['slots', 'connection']

interface Status { configured: boolean; writable: boolean; attempt?: PublicAttempt }
type Rpc = ConnectionHandle['rpc']

async function call<T>(rpc: Rpc, endpoint: string, payload: object, signal?: AbortSignal): Promise<T> {
  const result = await rpc.call('/api', `dsh-oauth.${endpoint}`, payload, signal)
  if (!result.ok) throw new Error(result.error.message)
  return result.value as T
}

function OAuthCard(props: { provider: ProviderId; rpc: Rpc }) {
  const id = props.provider
  const [status, setStatus] = useState<Status>()
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef<AbortController>()
  const mounted = useRef(false)
  const acting = useRef(false)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const next = await call<Status>(props.rpc, 'status', { provider: id }, controller.signal)
      if (!controller.signal.aborted && mounted.current) setStatus(next)
      return next
    } catch (reason) {
      if (!controller.signal.aborted && mounted.current) setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [props.rpc, id])
  useEffect(() => {
    mounted.current = true
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const next = acting.current ? undefined : await refresh()
      if (stopped) return
      const active = next?.attempt && !['complete', 'cancelled', 'error'].includes(next.attempt.phase)
      timer = setTimeout(() => void poll(), active ? 1000 : 5000)
    }
    void poll()
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); request.current?.abort() }
  }, [refresh])
  const execute = async (action: () => Promise<void>) => {
    if (acting.current) return
    acting.current = true
    request.current?.abort()
    setBusy(true); setError('')
    try { await action() }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally {
      if (mounted.current) { await refresh(); setBusy(false) }
      acting.current = false
    }
  }
  const attempt = status?.attempt
  const inProgress = attempt && !['complete', 'cancelled', 'error'].includes(attempt.phase)
  const notice = attempt?.notice
  const prompt = attempt?.prompt
  useEffect(() => setAnswer(''), [prompt?.id])
  return <div style={{ padding: '8px 0', display: 'grid', gap: 8 }}>
    <div role="status">{status?.configured ? 'OAuth 已登录 / Signed in' : 'OAuth 未登录 / Not signed in'}
      {inProgress ? ' · 登录中 / Signing in' : ''}</div>
    {!inProgress && status?.writable && <button type="button" disabled={busy} onClick={() => void execute(async () => {
      await call(props.rpc, 'begin', { provider: id })
    })}>登录 / Sign in</button>}
    {status?.configured && status.writable && <button type="button" disabled={busy} onClick={() => void execute(async () => {
      await call(props.rpc, 'logout', { provider: id })
    })}>退出登录 / Sign out</button>}
    {notice && inProgress && <div>
      <span>{notice.message}</span>{' '}
      {notice.url && /^https?:\/\//.test(notice.url) && <a href={notice.url} target="_blank" rel="noopener noreferrer">打开授权页面 / Open authorization page</a>}
      {notice.code && <div>验证码 / Code: <code>{notice.code}</code>{' '}
        <button type="button" onClick={() => void navigator.clipboard.writeText(notice.code!)}>复制 / Copy</button></div>}
    </div>}
    {prompt && inProgress && <div>
      <label>{prompt.message}</label>
      {prompt.type === 'select'
        ? <div>{prompt.options?.map(option => <button key={option.id} type="button" disabled={busy}
          onClick={() => void execute(async () => { await call(props.rpc, 'answer', {
            provider: id, id: attempt!.id, promptId: prompt.id, value: option.id,
          }) })}>{option.label}</button>)}</div>
        : <form onSubmit={event => { event.preventDefault(); void execute(async () => {
          await call(props.rpc, 'answer', { provider: id, id: attempt!.id,
            promptId: prompt.id, value: answer }); setAnswer('')
        }) }}>
          <input type={prompt.type === 'secret' ? 'password' : 'text'} value={answer}
            placeholder={prompt.placeholder} onChange={event => setAnswer(event.target.value)} />
          <button type="submit" disabled={busy}>提交 / Submit</button>
        </form>}
    </div>}
    {inProgress && attempt?.phase !== 'cancelling' && attempt?.phase !== 'finalizing' && <button type="button" disabled={busy} onClick={() => void execute(async () => {
      await call(props.rpc, 'cancel', { provider: id, id: attempt!.id })
    })}>取消 / Cancel</button>}
    {attempt?.phase === 'error' && <div role="alert">{attempt.error}</div>}
    {error && <div role="alert">{error}</div>}
  </div>
}

function ProviderCard(props: ProviderCardExtrasOwnerProps & { rpc: Rpc }) {
  const provider = props.provider.provider
  if (provider !== 'openai-codex' && provider !== 'github-copilot') return null
  return <OAuthCard key={provider} provider={provider} rpc={props.rpc} />
}

export function apply(ctx: Context): void {
  const rpc = (ctx.get('connection') as unknown as ConnectionHandle).rpc
  const slots = ctx.get('slots') as { inject(name: string, register: () => unknown): void;
    register(options: object, component: typeof ProviderCard): unknown }
  slots.inject('settings.models.provider-card', () => slots.register({
    name: 'settings.models.provider-card', key: 'llm-pi-ai',
    inject: () => ({ rpc }),
  }, ProviderCard))
}
