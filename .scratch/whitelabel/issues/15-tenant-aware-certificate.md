# whitelabel/15: Tenant-aware certificate

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md), [11](11-ssr-theme-application.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[03 — Resolution](03-scope-per-tenant-theming.md) decision 8.

## Why

For these orgs a certificate is a keepsake with the org's name and mark on it — but it must not
inherit the SSR palette override, or every tenant's certificate would recolor the gold-foil look
that's part of what makes it feel like a certificate.

## Scope

- `Certificate.tsx`: replace the two hardcoded `"My Course"` strings with the tenant's
  `displayName`; add the tenant logo.
- **Freeze the palette**: add a `.cert-doc { --accent: …; … }` token reset scoping the
  certificate's own container so the SSR tenant override (11) cannot bleed into it — the
  certificate keeps its default gold-foil look on **both** screen and print (per 01: print is not
  a tenant dimension).
- A certificate's canonical host is already its course's tenant host (no change needed there) —
  this issue is purely the identity swap + palette freeze.

## Acceptance criteria

- A certificate viewed under any tenant shows that tenant's `displayName` + logo.
- The certificate's colors are visually identical across all four tenants and the default site
  (frozen palette, not tenant-derived) — verify both screen view and the print stylesheet.
