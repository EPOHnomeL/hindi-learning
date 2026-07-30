---
type: task
blocked_by: []
---

# Brand continuity through the funnel

## Question

`<Brand>` (`src/app/_components/Brand.tsx`) is used only by the landing nav.
`SignIn`, `Dashboard`, `CourseShell` and `PublicReader` still hardcode "My Course"
and the book `Logo` (`.scratch/whitelabel/TODO.md`, "App-chrome brand rollout").
So a YWAM Potch learner meets a YWAM-branded landing page, signs in, and arrives
in a product with a different name — mid-funnel, immediately before being asked
for money. That is not polish; a name change at the payment step is a trust break,
and it sits exactly on the path this feature exists to repair.

Route the four remaining chrome surfaces through `<Brand>` so the tenant's logo
and display name show app-wide: `src/app/_components/SignIn.tsx`,
`Dashboard.tsx`, `CourseShell.tsx`, `PublicReader.tsx`. The tenant is already
resolved server-side from the host and available via `TenantContext` — a
substitution, not new plumbing.

Out of scope: per-tenant dark palettes (already done); bespoke landing pages for
the other three tenants; any change to `<Brand>`'s own API. Do **not** hand-seed
a tenant row shape that `tenants.seedTenant` wouldn't produce.

## Done when

On `ywampotch.my-course.app` the tenant logo and "YWAM Potch" appear on the
sign-in screen, dashboard, course reader and public reader; on the default site
(no tenant) all four still show "My Course" and the book `Logo`; and there is no
layout regression at mobile width on any of the four — verified on a real
subdomain, since the tenant resolves from the host.

## Answer

The premise was already stale when the ticket was written: only **`CourseShell`**
actually lacked a brand mark. `PublicReader` already rendered `<Brand>`
(`5cd6b76`); `SignIn` and `Dashboard` already rendered `tenant.logoUrl` /
`displayName` / `motto` directly with the "My Course" fallback (`18af604`), in
bespoke centred/header lockups that carry the motto — which `<Brand>` does not.
Routing those two through `<Brand>` would have *removed* the motto and shrunk the
logo, so they were left alone: they already meet the acceptance criteria.

Built (`1ffa433`): `<Brand>` added to `CourseShell`'s sidebar, mirroring
`PublicReader`'s pattern. Deliberately **not** in the mobile top bar — a fixed
`h-12` with an already-truncating course title, where a 7:1 banner logo would
wreck the layout. No unit test: the repo has no component-test infrastructure
(no RTL/jsdom; every `src/` test is pure logic), and the remaining check is a
browser look on a real subdomain.
