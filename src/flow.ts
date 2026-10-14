import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { githubCopilotProvider } from '@earendil-works/pi-ai/providers/github-copilot'
import type { AuthEvent, AuthPrompt, OAuthCredential } from '@earendil-works/pi-ai'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'

export const PROVIDERS = ['openai-codex', 'github-copilot'] as const
export type ProviderId = typeof PROVIDERS[number]
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDERS.includes(value as ProviderId)
}

export interface PublicPrompt {
  id: string
  type: AuthPrompt['type']
  message: string
  placeholder?: string
  options?: readonly { id: string; label: string; description?: string }[]
}
export interface PublicNotice { message: string; url?: string; code?: string }
export interface PublicAttempt {
  id: string
  phase: 'starting' | 'waiting' | 'committing' | 'finalizing' | 'cancelling' | 'complete' | 'cancelled' | 'error'
  notice?: PublicNotice
  prompt?: PublicPrompt
  error?: string
}
interface PendingPrompt {
  id: string
  resolve(value: string): void
  reject(reason: Error): void
}
interface Attempt {
  id: string
  controller: AbortController
  state: PublicAttempt
  pending?: PendingPrompt
  commitAccepted: boolean
  done: Promise<void>
}

export interface CredentialRecords {
  describeRecord: CredentialProvider['describeRecord']
  modifyRecord: CredentialProvider['modifyRecord']
  deleteRecord: CredentialProvider['deleteRecord']
}

const cancelled = () => new Error('Login cancelled')
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

/** Only the provider OAuth implementation creates grants. The plugin owns the commit decision. */
export class OAuthCoordinator {
  private attempts = new Map<ProviderId, Attempt>()
  private closed = false
  private logouts = new Map<ProviderId, Promise<void>>()
  constructor(
    private readonly credentials: CredentialRecords,
    private readonly home = resolveDshHome(),
    private readonly oauthLogin: (provider: ProviderId, interaction: {
      signal: AbortSignal
      prompt: (prompt: AuthPrompt) => Promise<string>
      notify: (event: AuthEvent) => void
    }) => Promise<OAuthCredential> = (provider, interaction) => {
      const builtIn = provider === 'openai-codex' ? openaiCodexProvider() : githubCopilotProvider()
      const oauth = builtIn.auth.oauth
      if (!oauth) throw new Error(`Official OAuth unavailable for ${provider}`)
      return oauth.login(interaction)
    },
    private readonly timeoutMs = 10 * 60 * 1000,
  ) {}

  async status(provider: ProviderId): Promise<{ configured: boolean; writable: boolean; attempt?: PublicAttempt }> {
    const info = await this.credentials.describeRecord(recordKeyFor(provider))
    const attempt = this.attempts.get(provider)
    return {
      configured: info.configured && info.kind === 'grant',
      writable: info.writable,
      ...(attempt ? { attempt: structuredClone(attempt.state) } : {}),
    }
  }

  begin(provider: ProviderId): { id: string } {
    if (this.closed) throw new Error('Plugin is stopping')
    if (this.logouts.has(provider)) throw new Error('Logout in progress')
    const previous = this.attempts.get(provider)
    if (previous && !this.isTerminal(previous.state.phase)) throw new Error('Login already in progress')
    const id = randomUUID()
    const attempt: Attempt = {
      id, controller: new AbortController(),
      state: { id, phase: 'starting' }, commitAccepted: false, done: Promise.resolve(),
    }
    this.attempts.set(provider, attempt)
    attempt.done = this.run(provider, attempt)
    return { id }
  }

  answer(provider: ProviderId, id: string, promptId: string, value: string): void {
    const attempt = this.active(provider, id)
    const pending = attempt.pending
    if (!pending || pending.id !== promptId) throw new Error('Prompt is no longer active')
    const prompt = attempt.state.prompt
    if (prompt?.type === 'select' && !prompt.options?.some(option => option.id === value)) throw new Error('Invalid option')
    pending.resolve(value)
  }

  cancel(provider: ProviderId, id: string): void {
    const attempt = this.active(provider, id)
    if (this.isTerminal(attempt.state.phase)) throw new Error('Login is no longer active')
    if (attempt.commitAccepted) throw new Error('Credential commit has already started')
    this.invalidate(attempt)
  }

  logout(provider: ProviderId): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Plugin is stopping'))
    const existing = this.logouts.get(provider)
    if (existing) return existing
    // Reserve synchronously, before another begin() can enter.
    const operation = Promise.resolve().then(async () => {
      const attempt = this.attempts.get(provider)
      if (attempt && !this.isTerminal(attempt.state.phase)) this.invalidate(attempt)
      if (attempt) await attempt.done
      await this.withOperationLock(provider, () => this.credentials.deleteRecord(recordKeyFor(provider)))
    }).finally(() => { this.logouts.delete(provider) })
    this.logouts.set(provider, operation)
    return operation
  }

  async close(): Promise<void> {
    this.closed = true
    for (const attempt of this.attempts.values()) this.invalidate(attempt)
    await Promise.allSettled([...this.attempts.values()].map(attempt => attempt.done).concat([...this.logouts.values()]))
  }

  private async run(provider: ProviderId, attempt: Attempt): Promise<void> {
    let expired = false
    const timer = setTimeout(() => {
      if (attempt.commitAccepted) return
      expired = true
      this.invalidate(attempt)
    }, this.timeoutMs)
    timer.unref()
    try {
      await this.withOperationLock(provider, async () => {
        if (attempt.controller.signal.aborted) throw cancelled()
        const credential = await this.oauthLogin(provider, {
          signal: attempt.controller.signal,
          notify: event => this.notice(attempt, event),
          prompt: prompt => this.prompt(attempt, prompt),
        })
        if (attempt.controller.signal.aborted) throw cancelled()
        attempt.state = { ...attempt.state, phase: 'committing', prompt: undefined }
        const key = recordKeyFor(provider)
        const stored = await this.credentials.modifyRecord(key, async () => {
          // This callback runs after the official store's queue and file lock.
          // Cancellation during either wait prevents a stale grant commit.
          if (attempt.controller.signal.aborted || this.attempts.get(provider) !== attempt) return undefined
          if (credential.type !== 'oauth') throw new Error('Official login returned a non-OAuth credential')
          // Synchronous decision under the official store's exclusive lock:
          // cancellation before this line wins; after it, logout waits for
          // the official write and then deletes, preserving old grants on
          // cancelled re-login attempts.
          const payload = JSON.parse(JSON.stringify(credential))
          attempt.commitAccepted = true
          attempt.state = { id: attempt.id, phase: 'finalizing' }
          return { kind: 'grant', payload }
        })
        if (attempt.controller.signal.aborted || this.attempts.get(provider) !== attempt) throw cancelled()
        if (stored?.kind !== 'grant') throw new Error('OAuth credential was not saved')
      })
      attempt.state = { id: attempt.id, phase: 'complete' }
    } catch (error) {
      attempt.state = { id: attempt.id, phase: attempt.controller.signal.aborted && !expired ? 'cancelled' : 'error',
        ...(expired ? { error: 'Login timed out. Start a new login.' }
          : attempt.controller.signal.aborted ? {} : { error: errorMessage(error) }) }
    } finally {
      clearTimeout(timer)
      attempt.pending?.reject(cancelled())
      attempt.pending = undefined
    }
  }

  private async withOperationLock<T>(provider: ProviderId, operation: () => Promise<T>): Promise<T> {
    const dir = join(this.home, 'plugins', 'dsh-oauth')
    await mkdir(dir, { recursive: true, mode: 0o700 })
    return withFileLock(join(dir, provider), operation, { waitMs: 500 })
  }

  private notice(attempt: Attempt, event: AuthEvent): void {
    if (attempt.controller.signal.aborted) return
    const notice: PublicNotice = event.type === 'auth_url'
      ? { message: event.instructions ?? 'Open the authorization page.', url: event.url }
      : event.type === 'device_code'
        ? { message: 'Enter this code on the verification page.', url: event.verificationUri, code: event.userCode }
        : { message: event.message, ...(event.type === 'info' && event.links?.[0] ? { url: event.links[0].url } : {}) }
    attempt.state = { ...attempt.state, phase: 'waiting', notice }
  }

  private prompt(attempt: Attempt, prompt: AuthPrompt): Promise<string> {
    if (attempt.controller.signal.aborted || prompt.signal?.aborted) return Promise.reject(cancelled())
    return new Promise<string>((resolve, reject) => {
      attempt.pending?.reject(cancelled())
      const id = randomUUID()
      const view: PublicPrompt = { id, type: prompt.type, message: prompt.message,
        ...('placeholder' in prompt && prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
        ...(prompt.type === 'select' ? { options: prompt.options } : {}) }
      const cleanup = () => {
        attempt.controller.signal.removeEventListener('abort', abort)
        prompt.signal?.removeEventListener('abort', abort)
        if (attempt.pending?.id === id) attempt.pending = undefined
        if (attempt.state.prompt?.id === id) attempt.state = { ...attempt.state, prompt: undefined }
      }
      const abort = () => { cleanup(); reject(cancelled()) }
      attempt.pending = { id, resolve: value => { cleanup(); resolve(value) }, reject: reason => { cleanup(); reject(reason) } }
      attempt.state = { ...attempt.state, phase: 'waiting', prompt: view }
      attempt.controller.signal.addEventListener('abort', abort, { once: true })
      prompt.signal?.addEventListener('abort', abort, { once: true })
    })
  }

  private invalidate(attempt: Attempt): void {
    if (attempt.commitAccepted) return
    attempt.controller.abort()
    attempt.pending?.reject(cancelled())
    if (!this.isTerminal(attempt.state.phase)) attempt.state = { id: attempt.id, phase: 'cancelling' }
  }
  private active(provider: ProviderId, id: string): Attempt {
    if (this.closed) throw new Error('Plugin is stopping')
    const attempt = this.attempts.get(provider)
    if (!attempt || attempt.id !== id) throw new Error('Login attempt not found')
    return attempt
  }
  private isTerminal(phase: PublicAttempt['phase']): boolean {
    return phase === 'complete' || phase === 'cancelled' || phase === 'error'
  }
}
