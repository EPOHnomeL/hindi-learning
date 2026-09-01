---
type: grilling
blocked_by: []
---
# Can the default site be switched off?

## Question

`assertTenantFlag` returns early when `tenantSlug` is `undefined`, so the apex `my-course.app` has
every flag implicitly and permanently on. There is no `tenants` row for it, so there is nothing to
toggle. This was correct when it was written: the default site was the whole product, and a flag
was a way to give a tenant *less*.

It is now the flagship, it lists its own untenanted courses (course-publishing ticket 04), it takes
real money, and it is the one site the operator cannot switch anything off on. Course-publishing
ticket 04 already ruled on one facet, deliberately: **selling on the default site is implicitly
on**, absent `tenantSlug` satisfies the gate and defers to the deployment-wide `sellingEnabled()`,
with "no phantom tenant row" given as the reason.

The question is whether that reason survives an inventory ten switches long. Three candidate
answers, each with a different cost:

- **Keep the early return.** Cheapest, no migration, no phantom row. The apex is permanently
  all-on, and the only apex kill switch stays `PAYFAST_MODE`, which is platform-wide and blunt.
- **Seed a real `tenants` row for the apex** under a reserved slug. Every flag becomes uniform,
  `assertTenantFlag` loses its special case, and the admin Tenants tab gains an entry. But the row
  now also carries a theme, and `getTheme` resolving for the apex would change SSR behaviour on the
  busiest host. Say what happens to the theme half of that row.
- **A separate platform-level switch set**, distinct from `tenants.flags`, that the apex reads and
  a tenant does not. Two mechanisms instead of one, which is the thing `assertTenantFlag` exists to
  avoid.

Also answer the smaller sibling: an **unknown** slug currently fails closed, so every feature is
refused. Confirm that is still right once the flag count grows, since a Vercel preview URL or a
mistyped subdomain hits that path.

## Done when

- One of the three answers is picked, with the SSR and migration cost of the choice stated.
- If the apex gets a row, the Answer says what its `theme` holds and confirms whether `getTheme`
  begins resolving for the apex, because that is an SSR change on the busiest host.
- Course-publishing ticket 04's "selling is implicitly on for the default site" is either upheld or
  explicitly superseded, named as such so the other map's Decisions line is not silently falsified.
- The unknown-slug fail-closed behaviour is confirmed or changed.
