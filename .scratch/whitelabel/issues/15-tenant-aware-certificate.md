# whitelabel/15: Tenant-aware certificate

**Status:** done
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

## Resolution (2026-07-18)

**Identity swap.** New `CertIssuer` (in `Certificate.tsx`) reads the tenant from the existing
`useTenant()` seam (issue 11's `TenantContext`, which resolves on anonymous pages too — `getTheme`
is public), and renders the tenant's uploaded logo when present, else its `displayName`, falling
back to `"My Course"` on the default site / while loading. It replaces both hardcoded `"My Course"`
strings — the compact card's issuer line and the showcase signature block — so the in-app dialog,
the celebration, and the public `/certificate/[token]` page all pick up the tenant's mark from one
place. Logo uses the same object-contain slot logic as `Brand.tsx` (tenant logos vary wildly in
aspect).

**Palette freeze (the crux).** Added a `.cert-card` token reset in `globals.css` that re-declares
all 14 `--color-*` tokens back to the default palette (light + a `html[data-theme="dark"] .cert-card`
dark block). Issue 11's SSR override sets the tenant palette on `:root:root`; because custom-property
resolution prefers a declaration on the element itself over any inherited one — regardless of the
`:root:root` specificity — pinning the tokens on `.cert-card` wins for the card and every descendant,
so the gold-foil look can't be recoloured. `.cert-card` is on **both** the compact and showcase
cards, so one reset covers both; it's media-agnostic, so screen and print freeze alike (print is not
a tenant dimension, per 01). The `.cert-medallion` in the owner Emblem settings preview is
deliberately *not* frozen — it's not a certificate.

**Tests.** `src/styles/globals-cert-freeze.test.ts` parses `globals.css` and asserts the `.cert-card`
freeze declares every one of the 14 contract tokens in both light and dark, and that each frozen
value **equals** the default `:root` / dark palette — encoding "frozen = default" so a new/renamed
token can't silently slip the freeze and no value can drift. Gates: `pnpm typecheck` clean; the new
test + the rest of the certificate/token suite green.

**Browser/print check pending** (same posture as 11/13/19–22/24): the "visually identical across all
four tenants + default, screen **and** print" acceptance is inherently visual and left for a human
pass — the source-level equality is pinned by the test above.

> Note: at commit time the working tree also carried unrelated in-flight changes from concurrent
> sessions (an invites feature + a `tenantBackfill` script referencing an unlanded Convex module);
> those cause a `pnpm build`/one `invite-emails` test failure that is **not** from this issue. This
> issue's own files compile, typecheck, and test green.
