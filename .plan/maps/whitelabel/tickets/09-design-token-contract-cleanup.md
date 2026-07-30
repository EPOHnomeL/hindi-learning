---
type: task
blocked_by: []
---
# Design token contract cleanup

## Question

Every tenant theme (03) is a token override; the override only works if there's one canonical
token contract everything reads from. No data-model dependency — a single-brand cleanup pass, safe
first or parallel with 07. Ground truth: 01's resolution. Scope:

- Add `src/design/tokens.ts`: the 14-token name list (`paper card ink soft line accent accent2 gold
  hi danger good good-b bad bad-b`) and the `TenantTheme` type (`light` required record, `dark`
  optional partial).
- Reconcile `globals.css` + `head.html` to the contract: both define the full 14-token set under
  matching names (align `--color-danger` vs `--bad`/`--bad-b` naming drift from 01).
- Replace the 7 raw-red hardcoded error colors with the `danger` token: `AdminPanel.tsx:119,143`,
  `ArtifactView.tsx:486`, `Certificate.tsx:684`, `SignIn.tsx:45` (re-verify lines against `main`).
- No component reorg. Do **not** touch lesson-blob application (that's 11/13).

## Done when

`src/design/tokens.ts` exists, exported and typed, with no hardcoded duplicate of the token list;
`globals.css` and `head.html` both define all 14 tokens under the same names; no raw red hex
remains for error states in the four named files; the default site renders identically
before/after (a rename/reconciliation pass, not a redesign).

## Answer

Built test-first (2026-07-16). **Seam:** the exported `TENANT_THEME_TOKENS` contract + both
stylesheets defining all 14 — `src/design/tokens.test.ts` locks the 14-name list (spec literal)
and asserts `globals.css` (`--color-<t>`) and `head.html` (`--<t>`) each define every token.

- **Contract** (`src/design/tokens.ts`): `TENANT_THEME_TOKENS` + `Token` + `TenantTheme` (`light`
  complete, `dark` partial), per-surface prefix rule and token semantics documented. No
  pre-existing `src` duplicate. (Convex's mirror list in `convex/tenants.ts` stays separate —
  Convex can't import `src/`.)
- **Reconcile:** `globals.css` gained `good`/`good-b`/`bad`/`bad-b` (light + dark, inert in chrome);
  `head.html` gained `line`/`danger` (light + dark, inert in lessons). Both additive, zero visual
  change. Values are `head.html`'s (code-is-canonical). Re-bundled via `pnpm bundle:authoring`;
  that regeneration also normalized `REFERENCE_HEAD`'s line endings to CRLF, which **fixed** the
  pre-existing `bundle-authoring-assets` failure as a side effect.
- **Error color:** the 7 raw `text-red-600`/`dark:text-red-400` at 01's audited lines → `text-danger`
  (the token carries its own dark value, so `dark:` variants drop). The one *intended* visual change.

**Verified:** full suite 292/292 (+3 token tests, +1 fixed bundle test); typecheck clean; `pnpm
build` compiles all 10 routes. **Not done (out of scope):** deeper line-ending hygiene (no
`.gitattributes`; the generated bundle commits CRLF-escaped strings on this Windows tree) — its own
chore. **Unblocks 11, 13.**
