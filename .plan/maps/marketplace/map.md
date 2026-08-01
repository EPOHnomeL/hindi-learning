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
- **This effort carries its own implementation tickets** — the wayfinder "plan, don't do"
  default is overridden here, deliberately (2026-08-01). A decision ticket and the build it
  authorises are **separate tickets**, so the map shows at a glance what is *decided* (a
  resolved star) versus what is *decided but not yet built* (an unstarted star hanging off
  it) — chartr derives one status per file, so this split is the only way that difference is
  visible. Build tickets say so in their title ("Build …") and are always `blocked_by` the
  decision ticket that authorised them.

## Decisions so far

<!-- one line per resolved ticket -->

- [Donation functionality](tickets/03-donation-link-and-prompt.md) — an **in-app rail, not a
  link** (the 10% cut forces the money through our PayFast account): a flag-gated
  `#donations` section per tenant, **Guest donor with no email field** (PayFast collects it,
  the ITN returns it), **USD typed / ZAR charged** at a committed constant with an explicit
  anti-surprise line, 10% via `splitNet(net, 1000)`, owed to a sys-admin-set `donationPayee`
  through the existing Ledger + Payouts tab. **No intent table and no public mutation** — it
  rides on `custom_str1/custom_str2`, so ADR 0013's guarantee holds. One-off only.
  **Decided, not built** — its Handoff section names the build tickets.
- [Build the donation rail — backend, config and ADR 0027](tickets/07-build-donation-rail-backend.md) —
  **built and shipped**; [ADR 0027](../../../docs/adr/0027-per-tenant-donation-rail.md) is the
  record. Money half only — the widget is [08](tickets/08-build-donation-widget-and-landing-section.md),
  now unblocked. Three deliberate deviations from the ticket, each argued in its Answer: **no
  tenant-flag backfill** (the flag is optional, because absence *means off* and that is
  fail-closed), **`kind` left optional** with Sales filtering `!== "donation"` (a required `kind`
  needs two deploys, and between them `=== "sale"` would drop the whole pre-0027 sales history),
  and `usdCents` over `usdAmount`. Rate **18.4**, minimum **$5**. One loose end, deliberately not
  a ticket: run `backfill-ledger-kind:prod`, then narrow `kind` — hygiene that buys safety for a
  *third* money kind, owed by whoever next touches the Ledger schema.

## Not yet specified

- **Ranking, search and filtering** on discover — real questions at scale, meaningless at four
  tenants. Deliberately not ticketed.
- **BYOK key storage mechanics** (per-owner encrypted, scoped, never logged) — named in
  ADR 0014, only worth ticketing if 01's BYOK branch wins.
- **Donation reporting for a payee** — a tenant admin can currently see none of their own
  donation income; only the sys admin's Payouts tab shows it. Whether that needs a
  tenant-facing view at all is unclear until donations are actually flowing, so there is
  nothing to anchor it to yet.

## Out of scope

- The paygate access mechanics — decided in ADR 0016 and already shipping.
- The publish mechanics — shipped on [course-publishing](../course-publishing/map.md).
- Paid-ads and distribution tooling.
- **Donations in the admin Sales report** ([03](tickets/03-donation-link-and-prompt.md)) — that
  report is revenue per course per edition; a donation has no course and folding it in corrupts
  the per-course numbers. Donations surface in Payouts only.
- **EFT donations** ([03](tickets/03-donation-link-and-prompt.md)) — card-only. The EFT rail's
  human-typed reference exists to reconcile a *known* price against a bank statement; a
  donor-chosen arbitrary amount is much harder to match by hand.
- **A donation popup on Public links** ([03](tickets/03-donation-link-and-prompt.md)) — the
  ticket's original second idea. It interrupts a Guest mid-lesson, and it is the one place
  ADR 0013's queries-only Guest seam would need reasoning about again.
- **Section 18A tax receipts for donors** ([03](tickets/03-donation-link-and-prompt.md)) —
  structurally impossible under ADR 0026: the operator is merchant of record, so the donation
  never reaches the tenant's PBO. Fixing it means reversing merchant-of-record for donations,
  which is its own effort. Flagged for an accountant, not deferred as work.
