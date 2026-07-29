# ywampotch-launch/01: Brand continuity through the funnel

**Status:** open

## Why

`<Brand>` (`src/app/_components/Brand.tsx`) is used only by the landing nav.
`SignIn`, `Dashboard`, `CourseShell` and `PublicReader` still hardcode "My Course"
and the book `Logo` (`.scratch/whitelabel/TODO.md`, "App-chrome brand rollout").

So a YWAM Potch learner meets a YWAM-branded landing page, signs in, and arrives
in a product with a different name — mid-funnel, immediately before being asked
for money. That is not polish; a name change at the payment step is a trust break,
and it sits exactly on the path this feature exists to repair.

## Scope

Route the four remaining chrome surfaces through `<Brand>` so the tenant's logo
and display name show app-wide:

- `src/app/_components/SignIn.tsx`
- `src/app/_components/Dashboard.tsx`
- `src/app/_components/CourseShell.tsx`
- `src/app/_components/PublicReader.tsx`

The tenant is already resolved server-side from the host and available via
`TenantContext` — this is a substitution, not new plumbing.

## Out of scope

- Per-tenant dark palettes (already done, 2026-07-29).
- Bespoke landing pages for the other three tenants (`registry.ts` — ywampotch
  already has one).
- Any change to `<Brand>`'s own API.

## Acceptance criteria

- On `ywampotch.my-course.app`, the tenant logo and "YWAM Potch" appear on the
  sign-in screen, the dashboard, the course reader, and the public reader.
- On the **default site** (no tenant), all four still show "My Course" and the
  book `Logo` — the fallback path is unchanged.
- No layout regression at mobile width on any of the four; the tenant logo is a
  different aspect ratio to the book glyph it replaces, so this needs looking at
  rather than assuming.

## Tests

- `<Brand>`'s tenant/default branching is already unit-testable; extend rather
  than duplicate if coverage exists.
- Do **not** hand-seed a tenant row shape that `tenants.seedTenant` wouldn't
  produce.

## Notes

Verify on a real subdomain, not localhost — the tenant resolves from the host.
