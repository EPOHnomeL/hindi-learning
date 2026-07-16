# whitelabel/09: Design token contract cleanup

**Status:** done (2026-07-16, `/tdd` + `/ponytail`)
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

## Resolution (2026-07-16)

Built test-first. **Seam:** the exported `TENANT_THEME_TOKENS` contract + both stylesheets defining
all 14 — [`src/design/tokens.test.ts`](../../../src/design/tokens.test.ts) locks the 14-name list
(spec literal, not derived) and asserts `globals.css` (`--color-<t>`) and `head.html` (`--<t>`) each
define every token.

- **Contract** ([`src/design/tokens.ts`](../../../src/design/tokens.ts)): `TENANT_THEME_TOKENS` +
  `Token` + `TenantTheme` (`light` complete, `dark` partial), with the per-surface prefix rule and
  token semantics documented. No pre-existing duplicate in `src` to dedupe. (Convex's mirror list in
  `convex/tenants.ts` stays separate — Convex can't import `src/`.)
- **Reconcile:** [`globals.css`](../../../src/styles/globals.css) gained `good`/`good-b`/`bad`/`bad-b`
  (light + dark) — inert in chrome, which renders no quiz states; [`head.html`](../../../lessons/_partials/head.html)
  gained `line`/`danger` (light + dark) — inert in lessons. Both additive, zero visual change. Values
  are `head.html`'s (code-is-canonical). Re-bundled via `pnpm bundle:authoring`; that regeneration
  also normalized `REFERENCE_HEAD`'s line endings to CRLF (matching `LESSON_HEAD`/`LESSON_FOOT`),
  which **fixed** the pre-existing `bundle-authoring-assets` failure as a side effect.
- **Error color** (AdminPanel×2, ArtifactView, Certificate, SignIn): the 7 raw `text-red-600` /
  `dark:text-red-400` at 01's exact audited lines → `text-danger` (the token carries its own dark
  value, so the `dark:` variants drop). This is the one *intended* visual change (bright `red-600`
  → brand brick `danger`), per AC #3.

**Verified:** full suite 292/292 (was 288/289 — +3 token tests, +1 fixed bundle test); typecheck
clean; `pnpm build` compiles Tailwind (incl. `text-danger`) and all 10 routes with no errors — the
deploy gate, proportionate for a mechanical CSS-token change with no happy-path visual delta.

**Not done here (out of scope):** deeper line-ending hygiene — no `.gitattributes`, so the generated
bundle commits CRLF-escaped strings on this Windows tree. A proper LF-normalization is its own chore.
**Unblocks 11 (SSR theme), 13 (lesson palette override).**
