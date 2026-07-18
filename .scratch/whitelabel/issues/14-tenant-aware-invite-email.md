# whitelabel/14: Tenant-aware invite email

**Status:** done
**Depends on:** [07](07-tenant-schema-and-seed.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[03 — Resolution](03-scope-per-tenant-theming.md) decision 7.

## Why

Closes the "My-Course-branded-invite-to-a-ywampotch-learner" leak the ADR flagged: without this,
every tenant's invite emails look like the default site regardless of which brand invited them.

## Scope

- `renderInviteEmail` (a pure renderer already parameterised by a flat inline-hex palette object
  `C` and a hardcoded `BRAND` string) gains tenant params:
  - `BRAND` → the tenant's `displayName`.
  - `C` → derived from the tenant's **light** tokens only (email dark mode is client-controlled,
    not worth chasing): `page ← paper`, `card ← card`, `border ← line`, `heading ← ink`,
    `body`/`muted ← soft`, `accent ← accent`.
  - Add the tenant logo as a header `<img>` (absolute storage URL), falling back to the text
    wordmark (`displayName`) when no logo is set.
- Thread the resolved tenant (by whichever `tenantSlug` the invite belongs to — the inviter's
  tenant, per ADR 0021) into whatever call site sends the invite today.

## Acceptance criteria

- An invite sent under a tenant renders with that tenant's brand name, derived palette, and logo
  (or wordmark fallback) — not the default site's branding.
- An invite sent under the default site is unchanged.

## Resolution (2026-07-18)

Built test-first (`convex/invite-emails.test.ts` +7 → 18 in-file / 490 suite pass).

**Renderer** ([convex/inviteEmail.ts](../../../convex/inviteEmail.ts))
- `renderInviteEmail(kind, data, brand?)` gained an optional third `brand` param. A `Brand` is
  `{ name, colors: Palette, logoUrl }`; omitting it (or passing the default) renders the pre-whitelabel
  email **byte-identical** — the module-level `BRAND`/`C` are now the `DEFAULT_BRAND` and the function
  shadows them with the brand's values.
- **`paletteFromTokens(light)`** (exported, pure) derives the 8-slot email palette from a tenant's
  light tokens per decision 7: `page←paper, card←card, border←line, heading←ink, body/muted←soft,
  accent←accent`; `faint` (no dedicated token) also takes `soft`; a missing token falls back to the
  house default so a partial palette can't blank a slot.
- Header renders the tenant logo as an `<img>` (absolute storage URL) when set, else the text wordmark
  (brand name in accent) — the existing default.

**Send path** ([convex/email.ts](../../../convex/email.ts), [convex/shares.ts](../../../convex/shares.ts))
- `sendInvite` takes an optional `brand: { name, light, logoUrl }` arg and derives the palette via
  `paletteFromTokens`. The brand is **resolved in the mutation** (`shares.ts` `tenantBrand()`, the same
  `by_slug` read `getTheme` uses) from the shared course's `tenantSlug` — the inviter owns the topic,
  so that's the inviter's tenant (ADR 0021) — and threaded through the scheduler. Resolving in the
  mutation (not the action) keeps the action a pure sender and sidesteps a convex-test artifact where a
  prior test's scheduled-function run poisons action-side `ctx.runQuery`. Default site (no/unknown slug)
  → `undefined` → house-branded email.

**Verified:** typecheck clean, 490 tests pass, `pnpm build` compiles. A real email-render browser check
stays pending (no authed dev session for a live send), consistent with 11/13/19–22/24.
