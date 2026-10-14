window.__ModuleLoader__.load({
	id: "dsh-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client.tsx
		const name = "dsh-oauth/client";
		const inject = ["slots", "connection"];
		async function call(rpc, endpoint, payload, signal) {
			const result = await rpc.call("/api", `dsh-oauth.${endpoint}`, payload, signal);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		}
		function OAuthCard(props) {
			const id = props.provider;
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "8px 0",
					display: "grid",
					gap: 8
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "status",
						children: [status?.configured ? "OAuth 已登录 / Signed in" : "OAuth 未登录 / Not signed in", inProgress ? " · 登录中 / Signing in" : ""]
					}),
					!inProgress && status?.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy,
						onClick: () => void execute(async () => {
							await call(props.rpc, "begin", { provider: id });
						}),
						children: "登录 / Sign in"
					}),
					status?.configured && status.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy,
						onClick: () => void execute(async () => {
							await call(props.rpc, "logout", { provider: id });
						}),
						children: "退出登录 / Sign out"
					}),
					notice && inProgress && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: notice.message }),
						" ",
						notice.url && /^https?:\/\//.test(notice.url) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: notice.url,
							target: "_blank",
							rel: "noopener noreferrer",
							children: "打开授权页面 / Open authorization page"
						}),
						notice.code && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							"验证码 / Code: ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: notice.code }),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void navigator.clipboard.writeText(notice.code),
								children: "复制 / Copy"
							})
						] })
					] }),
					prompt && inProgress && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: prompt.message }), prompt.type === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: prompt.options?.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
						children: option.label
					}, option.id)) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
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
							type: prompt.type === "secret" ? "password" : "text",
							value: answer,
							placeholder: prompt.placeholder,
							onChange: (event) => setAnswer(event.target.value)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: busy,
							children: "提交 / Submit"
						})]
					})] }),
					inProgress && attempt?.phase !== "cancelling" && attempt?.phase !== "finalizing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy,
						onClick: () => void execute(async () => {
							await call(props.rpc, "cancel", {
								provider: id,
								id: attempt.id
							});
						}),
						children: "取消 / Cancel"
					}),
					attempt?.phase === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						children: attempt.error
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
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
				rpc: props.rpc
			}, provider);
		}
		function apply(ctx) {
			const rpc = ctx.get("connection").rpc;
			const slots = ctx.get("slots");
			slots.inject("settings.models.provider-card", () => slots.register({
				name: "settings.models.provider-card",
				key: "llm-pi-ai",
				inject: () => ({ rpc })
			}, ProviderCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
