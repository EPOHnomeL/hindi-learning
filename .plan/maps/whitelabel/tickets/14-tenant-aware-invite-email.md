---
type: task
blocked_by: [07]
---
# Tenant-aware invite email

## Question

Closes the "My-Course-branded-invite-to-a-ywampotch-learner" leak the ADR flagged: without this,
every tenant's invite emails look like the default site. Ground truth: 03 decision 7. Scope:

- `renderInviteEmail` (a pure renderer parameterised by a flat inline-hex palette `C` and a
  hardcoded `BRAND`) gains tenant params: `BRAND` → the tenant's `displayName`; `C` → derived from
  the tenant's **light** tokens only (`page←paper`, `card←card`, `border←line`, `heading←ink`,
  `body`/`muted←soft`, `accent←accent`); add the tenant logo as a header `<img>` (absolute storage
  URL), falling back to the text wordmark.
- Thread the resolved tenant (by the inviter's tenant, per ADR 0021) into the invite send call site.

## Done when

An invite sent under a tenant renders with that tenant's brand name, derived palette, and logo (or
wordmark fallback) — not the default site's branding; an invite sent under the default site is
unchanged.

## Answer

Built test-first 2026-07-18 (`convex/invite-emails.test.ts` +7 → 18 in-file / 490 suite pass).

**Renderer** (`convex/inviteEmail.ts`)
- `renderInviteEmail(kind, data, brand?)` gained an optional third `brand` param. A `Brand` is
  `{ name, colors: Palette, logoUrl }`; omitting it (or the default) renders the pre-whitelabel email
  **byte-identical** — the module-level `BRAND`/`C` became `DEFAULT_BRAND`, shadowed by the brand's values.
- **`paletteFromTokens(light)`** (exported, pure) derives the 8-slot email palette per decision 7;
  `faint` (no dedicated token) also takes `soft`; a missing token falls back to the house default so
  a partial palette can't blank a slot.
- Header renders the tenant logo as an `<img>` (absolute storage URL) when set, else the text
  wordmark (brand name in accent).

**Send path** (`convex/email.ts`, `convex/shares.ts`)
- `sendInvite` takes an optional `brand: { name, light, logoUrl }` arg and derives the palette via
  `paletteFromTokens`. The brand is **resolved in the mutation** (`shares.ts` `tenantBrand()`, the
  same `by_slug` read `getTheme` uses) from the shared course's `tenantSlug` — the inviter owns the
  topic, so that's the inviter's tenant — and threaded through the scheduler. Resolving in the
  mutation (not the action) keeps the action a pure sender and sidesteps a convex-test artifact where
  a prior test's scheduled run poisons action-side `ctx.runQuery`. Default site → `undefined` →
  house-branded email.

**Verified:** typecheck clean, 490 tests pass, `pnpm build` compiles. A real email-render browser
check stays pending (no authed dev session for a live send), consistent with 11/13/19–22/24.
