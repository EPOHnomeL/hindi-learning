---
type: task
blocked_by: [07, 11]
---
# Tenant-aware certificate

## Question

For these orgs a certificate is a keepsake with the org's name and mark on it — but it must not
inherit the SSR palette override, or every tenant's certificate would recolor the gold-foil look
that's part of what makes it feel like a certificate. Ground truth: 03 decision 8. Scope:

- `Certificate.tsx`: replace the two hardcoded `"My Course"` strings with the tenant's
  `displayName`; add the tenant logo.
- **Freeze the palette:** add a `.cert-doc { --accent: …; … }` token reset scoping the certificate's
  container so the SSR tenant override (11) cannot bleed in — the certificate keeps its default
  gold-foil look on **both** screen and print (per 01: print is not a tenant dimension).
- A certificate's canonical host is already its course's tenant host — purely the identity swap +
  palette freeze.

## Done when

A certificate viewed under any tenant shows that tenant's `displayName` + logo; the certificate's
colors are visually identical across all four tenants and the default site (frozen palette, not
tenant-derived) — screen view and print stylesheet.

## Answer

Resolved 2026-07-18.

**Identity swap.** New `CertIssuer` (in `Certificate.tsx`) reads the tenant from the existing
`useTenant()` seam (11's `TenantContext`, which resolves on anonymous pages too — `getTheme` is
public), rendering the tenant's uploaded logo when present, else its `displayName`, falling back to
`"My Course"` on the default site / while loading. It replaces both hardcoded strings — the compact
card's issuer line and the showcase signature block — so the in-app dialog, the celebration, and the
public `/certificate/[token]` page all pick up the tenant's mark from one place. Logo uses the same
object-contain slot logic as `Brand.tsx`.

**Palette freeze (the crux).** Added a `.cert-card` token reset in `globals.css` that re-declares all
14 `--color-*` tokens back to the default palette (light + a `html[data-theme="dark"] .cert-card`
dark block). Issue 11's SSR override sets the tenant palette on `:root:root`; because
custom-property resolution prefers a declaration on the element itself over any inherited one —
regardless of `:root:root` specificity — pinning the tokens on `.cert-card` wins for the card and
every descendant, so the gold-foil can't be recoloured. `.cert-card` is on both the compact and
showcase cards, so one reset covers both; media-agnostic, so screen and print freeze alike. The
`.cert-medallion` in the owner Emblem settings preview is deliberately *not* frozen (not a certificate).

**Tests.** `src/styles/globals-cert-freeze.test.ts` parses `globals.css` and asserts the `.cert-card`
freeze declares all 14 contract tokens in both light and dark, and that each frozen value **equals**
the default `:root`/dark palette — encoding "frozen = default" so a new/renamed token can't slip the
freeze and no value can drift. Gates: `pnpm typecheck` clean; the new test + certificate/token suite green.

**Browser/print check pending** (same posture as 11/13/19–22/24): "visually identical across all four
tenants + default, screen and print" is inherently visual; the source-level equality is pinned by the
test. (Note: at commit time the tree also carried unrelated in-flight changes from concurrent
sessions — an invites feature + a `tenantBackfill` script — causing a `pnpm build`/one
`invite-emails` test failure not from this issue; this issue's own files compile, typecheck, and test green.)
