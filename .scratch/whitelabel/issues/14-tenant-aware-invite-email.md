# whitelabel/14: Tenant-aware invite email

**Status:** open
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
