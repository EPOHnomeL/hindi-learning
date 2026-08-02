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

- **The paygate spine is decided and shipping**: Edition-grain sale, free first-Lesson
  Preview, lifetime Entitlement, **no refunds**. Nothing on this map re-opens that — every
  ticket here consumes it.
- **⚠ Do not read the merchant model off ADR 0016.** This note used to say "Stripe Connect
  facilitator with the Seller as merchant of record, 15% platform fee", quoting 0016. **All
  three of those are wrong** (corrected 2026-08-01). ADR 0016 is `status: proposed` and was
  inverted by the PayFast pivot of 2026-07-08/07-10 that actually shipped; nothing supersedes
  it yet, so it still reads as current. The shipped reality: **PayFast**, the **operator as
  sole merchant of record** ([ADR 0026](../../../docs/adr/0026-manual-eft-payment-rail.md)),
  and a **50%** platform cut (`PLATFORM_FEE_BPS=5000`, split on the *net*). This matters most
  to the donation tickets, which touch the same rails and must not inherit a seller-as-merchant
  assumption. [Ticket 09](tickets/09-adr-superseding-0016-payfast-merchant-model.md) closes the
  record itself.
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
- ~~**The donation rail's remaining half is the widget**~~ — stale as of 2026-08-02; 08
  shipped, and so did 10 and 11. **The donation rail has no open tickets.** It is built end
  to end and reachable at `<tenant>.my-course.app/donate`; what remains is not code but
  *observation* — nobody has yet watched a real donation complete (08's operator checklist,
  10's happy path). The forward-pointer convention that bullet demonstrated still holds and
  is worth keeping: an OPEN ticket is named from Notes, never from Decisions-so-far, which
  indexes only the route already walked — naming an open ticket there is a malformation
  chartr catches (and did, twice).

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
  record. Money half only — the widget half is its own build ticket, now unblocked (see Notes).
  Three deliberate deviations from the ticket, each argued in its Answer: **no
  tenant-flag backfill** (the flag is optional, because absence *means off* and that is
  fail-closed), **`kind` left optional** with Sales filtering `!== "donation"` (a required `kind`
  needs two deploys, and between them `=== "sale"` would drop the whole pre-0027 sales history),
  and `usdCents` over `usdAmount`. Rate **18.4**, minimum **$5**. One loose end, deliberately not
  a ticket: run `backfill-ledger-kind:prod`, then narrow `kind` — hygiene that buys safety for a
  *third* money kind, owed by whoever next touches the Ledger schema.
- [Build the donation widget and landing section](tickets/08-build-donation-widget-and-landing-section.md) —
  **built and shipped**; the rail is now whole, donor end to end. A flag-gated
  `<section id="donations">` with $10/$25/$50/custom chips, in all five locales, placed
  automatically on the shared `<Landing/>` and by hand on bespoke ywampotch. Two reversals
  came out of the operator seeing it live (2026-08-02) and both are in the ticket: **the
  disclosures left the widget for terms clause 5** — the rand callout, the 10% and the
  not-a-tax-receipt line, reversing 03's "load-bearing" framing, with ADR 0027 edited to say
  so; and **the prod flag toggle's "Server Error"** turned out to be Convex redacting plain
  `Error` messages in production, fixed with `ConvexError` on this path plus a payee picker
  over ready sellers. ~~One limitation stated not fixed: `/` is the Dashboard when signed in,
  so a logged-in operator cannot see their own donate section.~~ **That limitation became a
  user-visible bug and is fixed** — see [Build the `/donate` route](tickets/10-build-donate-route.md)
  below. **The live sandbox donation is the one item not verifiable from a session** — the
  ticket ends in a six-step operator checklist.
- [Build the `/donate` route](tickets/10-build-donate-route.md) — **built and shipped**; the
  rail is now *reachable*. An ungated `/donate` outside `(app)` (the `(legal)` posture) whose
  whole body is `<DonateSection/>`, **coexisting** with the landing section rather than
  replacing it, so an already-shared link works and the passive ask survives. Prompted by a
  bug report whose two suspected causes were both wrong — the anchor id was always correct
  and nothing redirects. One root cause explained everything: the section isn't in the
  document when the browser acts on the hash. That included **a third break nobody reported —
  the PayFast `returnUrl` was `/?donation=thanks#donations`, so a donor who had just paid
  never saw the acknowledgement.** Round-trip URLs now point at `/donate`;
  `?donation=thanks` **replaces** the widget rather than banner-ing above it; the flag-off
  gate 404s and pointedly does *not* reuse `getTenantView()`, whose deliberate error-swallow
  would 404 a working page on a Convex blip. **Deployed and walked on live prod the same day**:
  `/donate` 200s on ywampotch, 404s on flag-off yknot and on the apex, and the live rail's
  round-trip URLs now point at `/donate`. Two things the ticket records rather than hides — the
  rendered widget still hasn't been seen by a human (curl can't run the client queries), and
  `id="donations"` is absent from the SSR HTML, so the page shows a brief empty gap before the
  widget hydrates. Spec: [A dedicated `/donate` route](spec-donate-route.md).
- [Fix the legacy `#donations` link in both auth states](tickets/11-fix-legacy-donations-anchor.md) —
  **built and shipped** in the same commit. Signed out, `DonateSection` scrolls itself into
  view once it has *actually mounted* — the existing mount effect couldn't do it, because
  hooks run before the early return and it fired while the component still rendered `null`.
  Signed in, `/` client-redirects to `/donate`, which **must** be client-side: a fragment is
  never sent to the server. Both are asserted from code rather than walked (no component-test
  harness in this repo), so the ticket ends in a three-step post-deploy check.

## Not yet specified

- **Ranking, search and filtering** on discover — real questions at scale, meaningless at four
  tenants. Deliberately not ticketed.
- **BYOK key storage mechanics** (per-owner encrypted, scoped, never logged) — named in
  ADR 0014, only worth ticketing if 01's BYOK branch wins.
- **Plain `Error` messages are invisible in production, everywhere.** Prod Convex redacts
  them, so every carefully-worded admin refusal in this codebase reaches the operator as
  "Server Error"; found the hard way on the donations flag (08), fixed on that path only.
  A sweep needs someone to decide which messages are *operator instructions* (ConvexError)
  and which are internal — that judgement call is why it isn't already a ticket.
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
