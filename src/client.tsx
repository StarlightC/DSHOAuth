import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { css } from './client-styles.js'
import { en, zh, type Translate } from './client-locales.js'
import type { PublicAttempt, ProviderId } from './flow.js'

export const name = 'dsh-oauth/client'
export const inject = ['slots', 'connection', 'locale']

interface Status { configured: boolean; writable: boolean; attempt?: PublicAttempt }
type Rpc = ConnectionHandle['rpc']

async function call<T>(rpc: Rpc, endpoint: string, payload: object, signal?: AbortSignal): Promise<T> {
  const result = await rpc.call('/api', `dsh-oauth.${endpoint}`, payload, signal)
  if (!result.ok) throw new Error(result.error.message)
  return result.value as T
}

function OAuthCard(props: { provider: ProviderId; rpc: Rpc; t: Translate }) {
  const id = props.provider
  const { t } = props
  const inputId = useId()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
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
  useEffect(() => { setCopied(false); setCopyError(false) }, [notice?.code, attempt?.id])
  const finishing = attempt?.phase === 'finalizing'
  const cancelling = attempt?.phase === 'cancelling'
  const stateLabel = !status ? t('loading') : cancelling ? t('cancelling')
    : finishing ? t('saving') : inProgress ? t('signingIn')
      : status.configured ? t('signedIn') : t('signedOut')
  const copyCode = async () => {
    const code = notice?.code
    if (!code) return
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(code)
      if (mounted.current) setCopied(true)
    } catch { if (mounted.current) setCopyError(true) }
  }
  return <div className="dsh-oauth">
    <div className="dsh-oauth__header">
      <div className="dsh-oauth__status" role="status">
        <span className="dsh-oauth__dot" aria-hidden="true"
          data-state={inProgress ? 'pending' : status?.configured ? 'signed-in' : 'signed-out'} />
        <span>OAuth · {stateLabel}</span>
      </div>
      <div className="dsh-oauth__actions">
        {!inProgress && status?.writable && <button className={`dsh-oauth__button${status.configured ? '' : ' dsh-oauth__button--primary'}`}
          type="button" disabled={busy} onClick={() => void execute(async () => {
            await call(props.rpc, 'begin', { provider: id })
          })}>{status.configured ? t('signInAgain') : t('signIn')}</button>}
        {!inProgress && status?.configured && status.writable && <button className="dsh-oauth__button dsh-oauth__button--quiet"
          type="button" disabled={busy} onClick={() => void execute(async () => {
            await call(props.rpc, 'logout', { provider: id })
          })}>{t('signOut')}</button>}
        {inProgress && !cancelling && !finishing && <button className="dsh-oauth__button dsh-oauth__button--quiet"
          type="button" disabled={busy} onClick={() => void execute(async () => {
            await call(props.rpc, 'cancel', { provider: id, id: attempt!.id })
          })}>{t('cancel')}</button>}
      </div>
    </div>
    {inProgress && !cancelling && !finishing && <div className="dsh-oauth__panel">
      {notice && <div className="dsh-oauth__field">
        <p className="dsh-oauth__message">{notice.message}</p>
        {notice.code && <div className="dsh-oauth__field">
          <span className="dsh-oauth__hint">{t('code')}</span>
          <div className="dsh-oauth__code-row">
            <code className="dsh-oauth__code">{notice.code}</code>
            <button className="dsh-oauth__button" type="button" onClick={() => void copyCode()}>{copied ? t('copied') : t('copy')}</button>
          </div>
          {copyError && <p className="dsh-oauth__error" role="alert">{t('copyFailed')}</p>}
        </div>}
        {notice.url && /^https?:\/\//.test(notice.url) && <div className="dsh-oauth__actions">
          <a className="dsh-oauth__button dsh-oauth__button--primary" href={notice.url} target="_blank" rel="noopener noreferrer">{t('openPage')}<span aria-hidden="true">↗</span></a>
        </div>}
      </div>}
      {prompt && <div className="dsh-oauth__field">
        <label className="dsh-oauth__message" id={`${inputId}-label`} htmlFor={prompt.type === 'select' ? undefined : inputId}>{prompt.message}</label>
        {prompt.type === 'select'
          ? <div className="dsh-oauth__options" role="group" aria-labelledby={`${inputId}-label`}>
            {prompt.options?.map(option => <button className="dsh-oauth__button dsh-oauth__option" key={option.id} type="button" disabled={busy}
              onClick={() => void execute(async () => { await call(props.rpc, 'answer', {
                provider: id, id: attempt!.id, promptId: prompt.id, value: option.id,
              }) })}><span>{option.label}</span>{option.description && <span className="dsh-oauth__hint">{option.description}</span>}</button>)}
          </div>
          : <form className="dsh-oauth__form" onSubmit={event => { event.preventDefault(); void execute(async () => {
            await call(props.rpc, 'answer', { provider: id, id: attempt!.id,
              promptId: prompt.id, value: answer }); setAnswer('')
          }) }}>
            <input className="dsh-oauth__input" id={inputId} disabled={busy} autoComplete="off" spellCheck={false}
              type={prompt.type === 'secret' ? 'password' : 'text'} value={answer}
              placeholder={prompt.placeholder} onChange={event => setAnswer(event.target.value)} />
            <button className="dsh-oauth__button dsh-oauth__button--primary" type="submit" disabled={busy}>{t('submit')}</button>
          </form>}
      </div>}
      {!notice && !prompt && <p className="dsh-oauth__hint">{t('waiting')}</p>}
    </div>}
    {status && !status.writable && <p className="dsh-oauth__hint">{t('readOnly')}</p>}
    {attempt?.phase === 'error' && <p className="dsh-oauth__error" role="alert">{attempt.error}</p>}
    {error && <p className="dsh-oauth__error" role="alert">{error}</p>}
  </div>
}

function ProviderCard(props: ProviderCardExtrasOwnerProps & { rpc: Rpc; t: Translate }) {
  const provider = props.provider.provider
  if (provider !== 'openai-codex' && provider !== 'github-copilot') return null
  return <OAuthCard key={provider} provider={provider} rpc={props.rpc} t={props.t} />
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('dsh-oauth', 'en', en), 'dsh-oauth: English')
  ctx.effect(() => ctx.locale.register('dsh-oauth', 'zh', zh), 'dsh-oauth: Chinese')
  const t = ctx.locale.bind('dsh-oauth') as Translate
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-oauth'
    tag.textContent = css
    document.head.appendChild(tag)
    return () => tag.remove()
  }, 'dsh-oauth: stylesheet')
  const rpc = (ctx.get('connection') as unknown as ConnectionHandle).rpc
  const slots = ctx.get('slots') as { inject(name: string, register: () => unknown): void;
    register(options: object, component: typeof ProviderCard): unknown }
  slots.inject('settings.models.provider-card', () => slots.register({
    name: 'settings.models.provider-card', key: 'llm-pi-ai',
    inject: () => ({ rpc, t }),
  }, ProviderCard))
}
