# whitelabel/09: Design token contract cleanup

**Status:** open
**Depends on:** —
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[01 — Resolution](01-scope-design-system-integration.md).

## Why

Every tenant theme (03) is a token override; the override only works if there's one canonical
token contract everything reads from. This issue has no data-model dependency — it's a
single-brand cleanup pass, safe to do first or in parallel with 07.

## Scope

- Add `src/design/tokens.ts`: the 14-token name list (`paper card ink soft line accent accent2
  gold hi danger good good-b bad bad-b`) and the `TenantTheme` type (`light` required record,
  `dark` optional partial record).
- Reconcile `globals.css` + `head.html` to the contract: both must define the full 14-token set
  under matching names (align `--color-danger` vs. `--bad`/`--bad-b` naming drift called out in
  01).
- Replace the 7 raw-red hardcoded error colors with the `danger` token: `AdminPanel.tsx:119,143`,
  `ArtifactView.tsx:486`, `Certificate.tsx:684`, `SignIn.tsx:45` (confirm exact lines/count
  against current `main` — 01's audit is from 2026-07-15, re-verify line numbers haven't drifted).
- No component reorg — `ui.tsx`/`icons.tsx`/`ThemeContext.tsx` stay where they are.
- Do **not** touch lesson-blob styling or per-surface application here — that's 11 and 13. This
  issue only pins the contract and does single-brand cleanup.

## Acceptance criteria

- `src/design/tokens.ts` exists, exported and typed; nothing else imports a hardcoded duplicate
  of the token list.
- `globals.css` and `head.html` both define all 14 tokens under the same names.
- No raw red hex remains for error states in the four named files — all read from `danger`.
- Visual regression check: default site (`my-course.app`) renders identically before/after (this
  is a rename/reconciliation pass, not a redesign).
