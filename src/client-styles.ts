// Scoped to the provider-card extension; values follow DSH ModelsSection controls.
// Kept in the client bundle so GitHub installations need no separate CSS loader.
export const css = `
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
`
