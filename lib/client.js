window.__ModuleLoader__.load({
	id: "dsh-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client-styles.ts
		const css = `
.dsh-oauth { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding-top: 12px; border-top: .5px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; }
.dsh-oauth__header, .dsh-oauth__actions, .dsh-oauth__code-row, .dsh-oauth__form { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.dsh-oauth__header { justify-content: space-between; gap: 8px 16px; }
.dsh-oauth__status { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); }
.dsh-oauth__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-dimmed); }
.dsh-oauth__dot[data-state="signed-in"] { background: var(--dsw-alias-state-success-primary); }
.dsh-oauth__dot[data-state="pending"] { background: var(--dsw-alias-state-business-primary); }
.dsh-oauth__button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none; gap: 6px; min-height: 28px; max-width: 100%; padding: 4px 10px; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-decoration: none; text-align: center; cursor: pointer; overflow-wrap: anywhere; }
.dsh-oauth__button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-solid); }
.dsh-oauth__button--primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.dsh-oauth__button--primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dsh-oauth__button--quiet { border-color: transparent; color: var(--dsw-alias-label-tertiary); }
.dsh-oauth__button:disabled { opacity: .4; cursor: default; }
.dsh-oauth__button:focus-visible, .dsh-oauth__input:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.dsh-oauth__panel { display: flex; flex-direction: column; align-items: stretch; gap: 14px; padding: 12px 14px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-module-platform); min-width: 0; }
.dsh-oauth__field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.dsh-oauth__message, .dsh-oauth__hint, .dsh-oauth__error { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.dsh-oauth__message { color: var(--dsw-alias-label-secondary); }
.dsh-oauth__hint { color: var(--dsw-alias-label-tertiary); }
.dsh-oauth__code { font-family: var(--ds-font-family-code, monospace); font-size: 16px; line-height: 24px; letter-spacing: .08em; user-select: all; overflow-wrap: anywhere; min-width: 0; }
.dsh-oauth__input { box-sizing: border-box; min-width: 0; flex: 1 1 200px; width: 100%; height: 32px; padding: 0 10px; border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; }
.dsh-oauth__input::placeholder { color: var(--dsw-alias-label-dimmed); }
.dsh-oauth__input:disabled { opacity: .6; }
.dsh-oauth__options { display: flex; flex-wrap: wrap; gap: 8px; }
.dsh-oauth__option { flex: 1 1 160px; flex-direction: column; align-items: flex-start; text-align: left; padding: 8px 10px; }
.dsh-oauth__error { color: var(--dsw-alias-state-error-primary); }
`;
		//#endregion
		//#region src/client-locales.ts
		const en = {
			loading: "Checking sign-in status…",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			signingIn: "Signing in…",
			cancelling: "Cancelling…",
			saving: "Finishing sign-in…",
			signIn: "Sign in",
			signInAgain: "Sign in again",
			signOut: "Sign out",
			cancel: "Cancel",
			openPage: "Open authorization page",
			code: "Verification code",
			copy: "Copy",
			copied: "Copied",
			copyFailed: "Could not copy. Select the code and copy it manually.",
			submit: "Continue",
			readOnly: "This credential is read-only.",
			waiting: "Waiting for authorization…"
		};
		const zh = {
			loading: "正在检查登录状态…",
			signedIn: "已登录",
			signedOut: "未登录",
			signingIn: "登录中…",
			cancelling: "正在取消…",
			saving: "正在完成登录…",
			signIn: "登录",
			signInAgain: "重新登录",
			signOut: "退出登录",
			cancel: "取消",
			openPage: "打开授权页面",
			code: "验证码",
			copy: "复制",
			copied: "已复制",
			copyFailed: "复制失败，请选中验证码手动复制。",
			submit: "继续",
			readOnly: "当前凭据为只读。",
			waiting: "等待授权完成…"
		};
		//#endregion
		//#region src/client.tsx
		const name = "dsh-oauth/client";
		const inject = [
			"slots",
			"connection",
			"locale"
		];
		async function call(rpc, endpoint, payload, signal) {
			const result = await rpc.call("/api", `dsh-oauth.${endpoint}`, payload, signal);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		}
		function OAuthCard(props) {
			const id = props.provider;
			const { t } = props;
			const inputId = (0, react.useId)();
			const [copied, setCopied] = (0, react.useState)(false);
			const [copyError, setCopyError] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)();
			const [answer, setAnswer] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const request = (0, react.useRef)();
			const mounted = (0, react.useRef)(false);
			const acting = (0, react.useRef)(false);
			const refresh = (0, react.useCallback)(async () => {
				request.current?.abort();
				const controller = new AbortController();
				request.current = controller;
				try {
					const next = await call(props.rpc, "status", { provider: id }, controller.signal);
					if (!controller.signal.aborted && mounted.current) setStatus(next);
					return next;
				} catch (reason) {
					if (!controller.signal.aborted && mounted.current) setError(reason instanceof Error ? reason.message : String(reason));
				}
			}, [props.rpc, id]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				let stopped = false;
				let timer;
				const poll = async () => {
					const next = acting.current ? void 0 : await refresh();
					if (stopped) return;
					const active = next?.attempt && ![
						"complete",
						"cancelled",
						"error"
					].includes(next.attempt.phase);
					timer = setTimeout(() => void poll(), active ? 1e3 : 5e3);
				};
				poll();
				return () => {
					stopped = true;
					mounted.current = false;
					clearTimeout(timer);
					request.current?.abort();
				};
			}, [refresh]);
			const execute = async (action) => {
				if (acting.current) return;
				acting.current = true;
				request.current?.abort();
				setBusy(true);
				setError("");
				try {
					await action();
				} catch (reason) {
					if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					if (mounted.current) {
						await refresh();
						setBusy(false);
					}
					acting.current = false;
				}
			};
			const attempt = status?.attempt;
			const inProgress = attempt && ![
				"complete",
				"cancelled",
				"error"
			].includes(attempt.phase);
			const notice = attempt?.notice;
			const prompt = attempt?.prompt;
			(0, react.useEffect)(() => setAnswer(""), [prompt?.id]);
			(0, react.useEffect)(() => {
				setCopied(false);
				setCopyError(false);
			}, [notice?.code, attempt?.id]);
			const finishing = attempt?.phase === "finalizing";
			const cancelling = attempt?.phase === "cancelling";
			const stateLabel = !status ? t("loading") : cancelling ? t("cancelling") : finishing ? t("saving") : inProgress ? t("signingIn") : status.configured ? t("signedIn") : t("signedOut");
			const copyCode = async () => {
				const code = notice?.code;
				if (!code) return;
				setCopyError(false);
				try {
					await navigator.clipboard.writeText(code);
					if (mounted.current) setCopied(true);
				} catch {
					if (mounted.current) setCopyError(true);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-oauth",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-oauth__header",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-oauth__status",
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-oauth__dot",
								"aria-hidden": "true",
								"data-state": inProgress ? "pending" : status?.configured ? "signed-in" : "signed-out"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["OAuth · ", stateLabel] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-oauth__actions",
							children: [
								!inProgress && status?.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `dsh-oauth__button${status.configured ? "" : " dsh-oauth__button--primary"}`,
									type: "button",
									disabled: busy,
									onClick: () => void execute(async () => {
										await call(props.rpc, "begin", { provider: id });
									}),
									children: status.configured ? t("signInAgain") : t("signIn")
								}),
								!inProgress && status?.configured && status.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsh-oauth__button dsh-oauth__button--quiet",
									type: "button",
									disabled: busy,
									onClick: () => void execute(async () => {
										await call(props.rpc, "logout", { provider: id });
									}),
									children: t("signOut")
								}),
								inProgress && !cancelling && !finishing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsh-oauth__button dsh-oauth__button--quiet",
									type: "button",
									disabled: busy,
									onClick: () => void execute(async () => {
										await call(props.rpc, "cancel", {
											provider: id,
											id: attempt.id
										});
									}),
									children: t("cancel")
								})
							]
						})]
					}),
					inProgress && !cancelling && !finishing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-oauth__panel",
						children: [
							notice && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-oauth__field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsh-oauth__message",
										children: notice.message
									}),
									notice.code && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-oauth__field",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-oauth__hint",
												children: t("code")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-oauth__code-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
													className: "dsh-oauth__code",
													children: notice.code
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsh-oauth__button",
													type: "button",
													onClick: () => void copyCode(),
													children: copied ? t("copied") : t("copy")
												})]
											}),
											copyError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsh-oauth__error",
												role: "alert",
												children: t("copyFailed")
											})
										]
									}),
									notice.url && /^https?:\/\//.test(notice.url) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-oauth__actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
											className: "dsh-oauth__button dsh-oauth__button--primary",
											href: notice.url,
											target: "_blank",
											rel: "noopener noreferrer",
											children: [t("openPage"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "↗"
											})]
										})
									})
								]
							}),
							prompt && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-oauth__field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "dsh-oauth__message",
									id: `${inputId}-label`,
									htmlFor: prompt.type === "select" ? void 0 : inputId,
									children: prompt.message
								}), prompt.type === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-oauth__options",
									role: "group",
									"aria-labelledby": `${inputId}-label`,
									children: prompt.options?.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: "dsh-oauth__button dsh-oauth__option",
										type: "button",
										disabled: busy,
										onClick: () => void execute(async () => {
											await call(props.rpc, "answer", {
												provider: id,
												id: attempt.id,
												promptId: prompt.id,
												value: option.id
											});
										}),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option.label }), option.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-oauth__hint",
											children: option.description
										})]
									}, option.id))
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
									className: "dsh-oauth__form",
									onSubmit: (event) => {
										event.preventDefault();
										execute(async () => {
											await call(props.rpc, "answer", {
												provider: id,
												id: attempt.id,
												promptId: prompt.id,
												value: answer
											});
											setAnswer("");
										});
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "dsh-oauth__input",
										id: inputId,
										disabled: busy,
										autoComplete: "off",
										spellCheck: false,
										type: prompt.type === "secret" ? "password" : "text",
										value: answer,
										placeholder: prompt.placeholder,
										onChange: (event) => setAnswer(event.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsh-oauth__button dsh-oauth__button--primary",
										type: "submit",
										disabled: busy,
										children: t("submit")
									})]
								})]
							}),
							!notice && !prompt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-oauth__hint",
								children: t("waiting")
							})
						]
					}),
					status && !status.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-oauth__hint",
						children: t("readOnly")
					}),
					attempt?.phase === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-oauth__error",
						role: "alert",
						children: attempt.error
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-oauth__error",
						role: "alert",
						children: error
					})
				]
			});
		}
		function ProviderCard(props) {
			const provider = props.provider.provider;
			if (provider !== "openai-codex" && provider !== "github-copilot") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OAuthCard, {
				provider,
				rpc: props.rpc,
				t: props.t
			}, provider);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("dsh-oauth", "en", en), "dsh-oauth: English");
			ctx.effect(() => ctx.locale.register("dsh-oauth", "zh", zh), "dsh-oauth: Chinese");
			const t = ctx.locale.bind("dsh-oauth");
			ctx.effect(() => {
				if (typeof document === "undefined") return () => {};
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-oauth";
				tag.textContent = css;
				document.head.appendChild(tag);
				return () => tag.remove();
			}, "dsh-oauth: stylesheet");
			const rpc = ctx.get("connection").rpc;
			const slots = ctx.get("slots");
			slots.inject("settings.models.provider-card", () => slots.register({
				name: "settings.models.provider-card",
				key: "llm-pi-ai",
				inject: () => ({
					rpc,
					t
				})
			}, ProviderCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
