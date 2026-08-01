# Marketplace

<!-- Charted 2026-08-01 by consolidating four single-ticket maps — paid-marketplace,
     marketplace-discover, donations and landing-page — that were each a lone issue
     wearing a map's clothes. Each ticket carries the context its old map held, folded
     in under a "Context folded from" heading. This map is an INDEX, not a store. -->

## Destination

The money side of the platform decided end to end: **who funds authoring**, **where a buyer
finds a course**, **how the landing page markets the paygate honestly**, and **whether the
site asks for donations at all** — the economics and the shopfront, not the paygate mechanics
that already ship.

## Notes

- **The paygate spine is decided and shipping** (ADR 0016): Edition-grain sale, free
  first-Lesson Preview, lifetime Entitlement, Stripe Connect facilitator with the Seller as
  merchant of record, 15% platform fee, **no refunds**. Nothing on this map re-opens that —
  every ticket here consumes it.
- **Ticket 01 is the blocked one and it blocks the least.** Authoring-cost funding needs real
  per-run token numbers first
  ([Cost instrumentation](../internal-course-studio/tickets/03-cost-instrumentation.md)), and
  it affects economics, not access mechanics — so 02, 03 and 04 do not wait on it.
- **02 and 04 are the same page from two angles** and should be reconciled, not built twice:
  04 markets the paygate as a *proposition*, 02 lists the actual *courses*. Both may be
  sections of one landing page; both are gated on the marketplace being live.
- **Check what already ships before scoping 02.** The course-publishing effort landed
  `publishedEditions`, owner-only publish mutations, a per-edition Publish toggle and an
  available-courses section on the signed-in home — see
  [course-publishing](../course-publishing/map.md). Discover may be a query and a route.
- **03 (donations) is the odd one out and belongs here anyway** — it is the other way money
  enters the system, it reuses the same rails (PayFast, the manual EFT rail from the
  ywampotch launch), and it must not be confused with a sale: a donation from a Guest on a
  Public link has no Entitlement, no merchant of record, and a different legal shape.
- **Whitelabel runs through all four:** does a tenant subdomain's discover page list that
  tenant's courses only? Does a YWAM Potch public link solicit for YWAM Potch or for the
  platform? Is the landing paygate section shared or per-tenant
  (`src/app/_landing/registry.ts`)?
- Skills: `/grilling`, `/ponytail` (02 and 03 may both be far smaller than they sound).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Ranking, search and filtering** on discover — real questions at scale, meaningless at four
  tenants. Deliberately not ticketed.
- **BYOK key storage mechanics** (per-owner encrypted, scoped, never logged) — named in
  ADR 0014, only worth ticketing if 01's BYOK branch wins.

## Out of scope

- The paygate access mechanics — decided in ADR 0016 and already shipping.
- The publish mechanics — shipped on [course-publishing](../course-publishing/map.md).
- Paid-ads and distribution tooling.
