import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { withFileLock } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { recordKeyFor } from "@deepseek-ai/dsh-llm-pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { githubCopilotProvider } from "@earendil-works/pi-ai/providers/github-copilot";
//#region src/flow.ts
const PROVIDERS = ["openai-codex", "github-copilot"];
function isProviderId(value) {
	return typeof value === "string" && PROVIDERS.includes(value);
}
const cancelled = () => /* @__PURE__ */ new Error("Login cancelled");
const errorMessage = (error) => error instanceof Error ? error.message : String(error);
/** Only the provider OAuth implementation creates grants. The plugin owns the commit decision. */
var OAuthCoordinator = class {
	credentials;
	home;
	oauthLogin;
	timeoutMs;
	attempts = /* @__PURE__ */ new Map();
	closed = false;
	logouts = /* @__PURE__ */ new Map();
	constructor(credentials, home = resolveDshHome(), oauthLogin = (provider, interaction) => {
		const oauth = (provider === "openai-codex" ? openaiCodexProvider() : githubCopilotProvider()).auth.oauth;
		if (!oauth) throw new Error(`Official OAuth unavailable for ${provider}`);
		return oauth.login(interaction);
	}, timeoutMs = 600 * 1e3) {
		this.credentials = credentials;
		this.home = home;
		this.oauthLogin = oauthLogin;
		this.timeoutMs = timeoutMs;
	}
	async status(provider) {
		const info = await this.credentials.describeRecord(recordKeyFor(provider));
		const attempt = this.attempts.get(provider);
		return {
			configured: info.configured && info.kind === "grant",
			writable: info.writable,
			...attempt ? { attempt: structuredClone(attempt.state) } : {}
		};
	}
	begin(provider) {
		if (this.closed) throw new Error("Plugin is stopping");
		if (this.logouts.has(provider)) throw new Error("Logout in progress");
		const previous = this.attempts.get(provider);
		if (previous && !this.isTerminal(previous.state.phase)) throw new Error("Login already in progress");
		const id = randomUUID();
		const attempt = {
			id,
			controller: new AbortController(),
			state: {
				id,
				phase: "starting"
			},
			commitAccepted: false,
			done: Promise.resolve()
		};
		this.attempts.set(provider, attempt);
		attempt.done = this.run(provider, attempt);
		return { id };
	}
	answer(provider, id, promptId, value) {
		const attempt = this.active(provider, id);
		const pending = attempt.pending;
		if (!pending || pending.id !== promptId) throw new Error("Prompt is no longer active");
		const prompt = attempt.state.prompt;
		if (prompt?.type === "select" && !prompt.options?.some((option) => option.id === value)) throw new Error("Invalid option");
		pending.resolve(value);
	}
	cancel(provider, id) {
		const attempt = this.active(provider, id);
		if (this.isTerminal(attempt.state.phase)) throw new Error("Login is no longer active");
		if (attempt.commitAccepted) throw new Error("Credential commit has already started");
		this.invalidate(attempt);
	}
	logout(provider) {
		if (this.closed) return Promise.reject(/* @__PURE__ */ new Error("Plugin is stopping"));
		const existing = this.logouts.get(provider);
		if (existing) return existing;
		const operation = Promise.resolve().then(async () => {
			const attempt = this.attempts.get(provider);
			if (attempt && !this.isTerminal(attempt.state.phase)) this.invalidate(attempt);
			if (attempt) await attempt.done;
			await this.withOperationLock(provider, () => this.credentials.deleteRecord(recordKeyFor(provider)));
		}).finally(() => {
			this.logouts.delete(provider);
		});
		this.logouts.set(provider, operation);
		return operation;
	}
	async close() {
		this.closed = true;
		for (const attempt of this.attempts.values()) this.invalidate(attempt);
		await Promise.allSettled([...this.attempts.values()].map((attempt) => attempt.done).concat([...this.logouts.values()]));
	}
	async run(provider, attempt) {
		let expired = false;
		const timer = setTimeout(() => {
			if (attempt.commitAccepted) return;
			expired = true;
			this.invalidate(attempt);
		}, this.timeoutMs);
		timer.unref();
		try {
			await this.withOperationLock(provider, async () => {
				if (attempt.controller.signal.aborted) throw cancelled();
				const credential = await this.oauthLogin(provider, {
					signal: attempt.controller.signal,
					notify: (event) => this.notice(attempt, event),
					prompt: (prompt) => this.prompt(attempt, prompt)
				});
				if (attempt.controller.signal.aborted) throw cancelled();
				attempt.state = {
					...attempt.state,
					phase: "committing",
					prompt: void 0
				};
				const key = recordKeyFor(provider);
				const stored = await this.credentials.modifyRecord(key, async () => {
					if (attempt.controller.signal.aborted || this.attempts.get(provider) !== attempt) return void 0;
					if (credential.type !== "oauth") throw new Error("Official login returned a non-OAuth credential");
					const payload = JSON.parse(JSON.stringify(credential));
					attempt.commitAccepted = true;
					attempt.state = {
						id: attempt.id,
						phase: "finalizing"
					};
					return {
						kind: "grant",
						payload
					};
				});
				if (attempt.controller.signal.aborted || this.attempts.get(provider) !== attempt) throw cancelled();
				if (stored?.kind !== "grant") throw new Error("OAuth credential was not saved");
			});
			attempt.state = {
				id: attempt.id,
				phase: "complete"
			};
		} catch (error) {
			attempt.state = {
				id: attempt.id,
				phase: attempt.controller.signal.aborted && !expired ? "cancelled" : "error",
				...expired ? { error: "Login timed out. Start a new login." } : attempt.controller.signal.aborted ? {} : { error: errorMessage(error) }
			};
		} finally {
			clearTimeout(timer);
			attempt.pending?.reject(cancelled());
			attempt.pending = void 0;
		}
	}
	async withOperationLock(provider, operation) {
		const dir = join(this.home, "plugins", "dsh-oauth");
		await mkdir(dir, {
			recursive: true,
			mode: 448
		});
		return withFileLock(join(dir, provider), operation, { waitMs: 500 });
	}
	notice(attempt, event) {
		if (attempt.controller.signal.aborted) return;
		const notice = event.type === "auth_url" ? {
			message: event.instructions ?? "Open the authorization page.",
			url: event.url
		} : event.type === "device_code" ? {
			message: "Enter this code on the verification page.",
			url: event.verificationUri,
			code: event.userCode
		} : {
			message: event.message,
			...event.type === "info" && event.links?.[0] ? { url: event.links[0].url } : {}
		};
		attempt.state = {
			...attempt.state,
			phase: "waiting",
			notice
		};
	}
	prompt(attempt, prompt) {
		if (attempt.controller.signal.aborted || prompt.signal?.aborted) return Promise.reject(cancelled());
		return new Promise((resolve, reject) => {
			attempt.pending?.reject(cancelled());
			const id = randomUUID();
			const view = {
				id,
				type: prompt.type,
				message: prompt.message,
				..."placeholder" in prompt && prompt.placeholder ? { placeholder: prompt.placeholder } : {},
				...prompt.type === "select" ? { options: prompt.options } : {}
			};
			const cleanup = () => {
				attempt.controller.signal.removeEventListener("abort", abort);
				prompt.signal?.removeEventListener("abort", abort);
				if (attempt.pending?.id === id) attempt.pending = void 0;
				if (attempt.state.prompt?.id === id) attempt.state = {
					...attempt.state,
					prompt: void 0
				};
			};
			const abort = () => {
				cleanup();
				reject(cancelled());
			};
			attempt.pending = {
				id,
				resolve: (value) => {
					cleanup();
					resolve(value);
				},
				reject: (reason) => {
					cleanup();
					reject(reason);
				}
			};
			attempt.state = {
				...attempt.state,
				phase: "waiting",
				prompt: view
			};
			attempt.controller.signal.addEventListener("abort", abort, { once: true });
			prompt.signal?.addEventListener("abort", abort, { once: true });
		});
	}
	invalidate(attempt) {
		if (attempt.commitAccepted) return;
		attempt.controller.abort();
		attempt.pending?.reject(cancelled());
		if (!this.isTerminal(attempt.state.phase)) attempt.state = {
			id: attempt.id,
			phase: "cancelling"
		};
	}
	active(provider, id) {
		if (this.closed) throw new Error("Plugin is stopping");
		const attempt = this.attempts.get(provider);
		if (!attempt || attempt.id !== id) throw new Error("Login attempt not found");
		return attempt;
	}
	isTerminal(phase) {
		return phase === "complete" || phase === "cancelled" || phase === "error";
	}
};
//#endregion
//#region src/index.ts
const name = "dsh-oauth";
const inject = ["credentials"];
function payloadObject(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
	return value;
}
function string(value, label, allowEmpty = false) {
	if (typeof value !== "string" || !allowEmpty && value.length === 0 || value.length > 8192) throw new Error(`Invalid ${label}`);
	return value;
}
const endpoints = [
	"status",
	"begin",
	"answer",
	"cancel",
	"logout"
];
/** The host authenticates these exact routes before dispatching. */
function registerRoutes(connection, coordinator) {
	return endpoints.map((operation) => {
		const endpoint = `dsh-oauth.${operation}`;
		return connection.fetch.register({
			path: `/api/${endpoint}`,
			methods: ["POST"],
			requestBody: "buffered",
			async fetch(request) {
				let envelope;
				try {
					envelope = payloadObject(await request.json());
					if (envelope.type !== "client-request" || envelope.method !== endpoint) throw new Error("Invalid envelope");
					string(envelope.rpcId, "rpcId");
				} catch {
					return new Response("Invalid RPC request", { status: 400 });
				}
				let result;
				try {
					const input = payloadObject(envelope.payload);
					const provider = input.provider;
					if (!isProviderId(provider)) throw new Error("Unsupported provider");
					let value;
					switch (operation) {
						case "status":
							value = await coordinator.status(provider);
							break;
						case "begin":
							value = coordinator.begin(provider);
							break;
						case "answer":
							coordinator.answer(provider, string(input.id, "attempt"), string(input.promptId, "prompt"), string(input.value, "answer", true));
							value = true;
							break;
						case "cancel":
							coordinator.cancel(provider, string(input.id, "attempt"));
							value = true;
							break;
						case "logout":
							await coordinator.logout(provider);
							value = true;
							break;
					}
					result = {
						ok: true,
						value
					};
				} catch (error) {
					result = {
						ok: false,
						error: {
							code: "dsh-oauth/request",
							message: error instanceof Error ? error.message : String(error),
							details: {}
						}
					};
				}
				return Response.json({
					type: "server-response",
					rpcId: envelope.rpcId,
					result
				});
			}
		});
	});
}
function apply(ctx) {
	const coordinator = new OAuthCoordinator(ctx.credentials);
	ctx.effect(() => () => coordinator.close(), "dsh-oauth: stop login attempts");
	ctx.inject(["connection"], (connected) => {
		registerRoutes(connected.get("connection"), coordinator);
	});
}
//#endregion
export { OAuthCoordinator, apply, endpoints, inject, name, registerRoutes };
