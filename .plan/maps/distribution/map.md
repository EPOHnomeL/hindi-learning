# Distribution: how a course reaches a learner, and how money comes back

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Every open question about **the path between a finished course and a person holding
it** lives in one place: buying, being given, redeeming, joining, sharing, and
donating.

Chartered 2026-09-01 by gathering the reach-and-revenue work scattered across five
feature maps (`marketplace`, `vouchers`, `shared-access-codes`, `topic-sharing`,
`auth-sessions`), during the consolidation that took `.plan` from 33 map directories to
7 active maps.

Scope is fixed by one test: **does this change how somebody gets access, or who gets
paid?** Checkout, discovery, vouchers, access codes, shares and recurring giving all
pass. What a course *contains* is `authoring`; whether a tenant may sell at all is
`tenant-feature-modularity`.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. Tickets
  [03](tickets/03-feature-paygate-on-landing.md),
  [05](tickets/05-guest-redemption-and-saving-it-to-an-account.md),
  [06](tickets/06-share-management.md) and
  [07](tickets/07-the-join-page.md) are execution. The grillings
  ([01](tickets/01-authoring-cost-and-model-provider-strategy.md),
  [02](tickets/02-marketplace-discover-component.md),
  [04](tickets/04-recurring-monthly-giving.md)) are genuine open decisions.
- **This map touches the live money rail.** Prod has taken real purchases since
  2026-07-29 on the operator's live merchant. Do not refactor `convex/payfast.ts` or
  `market.startCheckout` while passing through, do not test against prod, and use `tdd`
  for anything that moves money. **ADR 0016 no longer describes the rail that
  shipped**, and superseding it is
  [technical-foundation/14](../technical-foundation/tickets/14-adr-superseding-0016-payfast-merchant-model.md),
  not a thing to fix in passing here.
- **Verify before reasoning.** Checked in the tree on 2026-09-01: there is no pricing
  or marketplace section on the landing page (03 is real), `convex/auth.ts` carries no
  anonymous provider so guest redemption does not exist (05 is real), and `shareTopic`
  (`convex/shares.ts:79`) still has **no guard against sharing to the owner's own
  email** (06 is real). Re-check before acting; the marketplace tickets that came here
  were written up to three weeks ago.
- **Ticket 07 is code-built and holds open for a walk.** `/join` exists
  (`src/app/join/page.tsx` plus `JoinPanel.tsx`), outside the `(app)` group and on every
  host with no tenant flag. Its own `## Progress` section says why it is still open: the
  browser walk is outstanding. Two things in its `## Done when` are **superseded, not
  unbuilt**, and a session that reads the checklist without the Progress section will
  file false defects: the separate agree/refuse consent step went on 2026-08-26 (consent
  is now the act of submitting, and the page is two steps, not three), and a code that
  arrives on the link skips the code step entirely. The new/returning toggle is real and
  deliberate; see that ticket's own reasoning.
- **The URL param is `voucher` and can never be `code`.** `convexAuthNextjsMiddleware`
  claims `?code=` on any HTML GET as an OAuth exchange and strips it. Recorded here
  because it cost that ticket two failed client-side attempts, and because anything else
  on this map that mints a link is one rename away from the same trap.
- **01 cannot be decided blind.** It is the who-funds-authoring fork, and its own Done
  when demands real numbers rather than a guess. Those numbers are
  [technical-foundation/12](../technical-foundation/tickets/12-cost-instrumentation.md)
  (tokens per Routine run). The edge is cross-map, so it is prose here and not a
  `blocked_by`, but do not open 01 before 12 has run.
- **06's cascade half waits on a delete mutation.** The share cascade cannot be built
  until a course can be deleted, which is
  [authoring/03](../authoring/tickets/03-delete-button-for-courses.md). The self-share
  guard is independent and ships now.

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | Authoring-cost funding and model-provider strategy | `marketplace/01` |
| 02 | Marketplace / discover component | `marketplace/02` |
| 03 | Feature the paid marketplace on the landing page | `marketplace/04` |
| 04 | Recurring monthly giving | `marketplace/06` |
| 05 | Guest redemption, and saving it to an account | `vouchers/11` |
| 06 | Share management and edge cases | `topic-sharing/06` |
| 07 | The `/join` page | `shared-access-codes/05` |

Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
donor maps. The old numbers remain those tickets' identity in their donor maps'
history, so **do not reuse them here**. Each moved ticket carries an HTML comment
footer naming where it came from, including the three (04, 05, 07) whose `blocked_by`
pointed at a resolved ticket that stayed behind on its donor map.

`auth-sessions` contributed no ticket here. Its forgot-password flow went to
[technical-foundation/21](../technical-foundation/tickets/21-forgot-password-flow.md) to
sit beside session management, which came out of the same map; account recovery is a
session question, not a distribution one.

The finished rails underneath this map, which stay where they are: the
[vouchers](../vouchers/map.md) effort (10 of 11 done),
[shared-access-codes](../shared-access-codes/map.md) (ADR 0031), the donation rail on
[marketplace](../marketplace/map.md) (tickets 03, 07, 08, 10, 11), and
[ywampotch-launch](../ywampotch-launch/map.md), which is the whole funnel plus the
manual EFT rail. Read the last one before touching checkout.

## The dependency graph

**No edges.** All seven tickets are on the frontier. Every real ordering constraint on
this map points at a *different* map, which is worth saying plainly rather than leaving
as an absence:

```
frontier (7):  01 02 03 04 05 06 07
blocked   (0):  none

cross-map, prose not edges:
  technical-foundation/12 (cost instrumentation)  ->  01
  authoring/03 (delete a course)                  ->  06's cascade half
  technical-foundation/14 (supersede ADR 0016)    ->  03's accuracy
```

- **12 to 01** is the strongest of the three: 01's own Done when says the fork must
  close "against real cost-instrumentation numbers rather than blind".
- **14 to 03**: 03 was already restated once on 2026-08-18 because both halves of its
  original sentence went stale, ADR 0016 included. A landing page that markets the rail
  inaccurately is the failure mode, so know which description is true first.

## Decisions so far

<!-- one line per resolved ticket -->

_(none yet: chartered 2026-09-01.)_

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. Two of these were tickets
     until 2026-09-01; their full bodies are kept at assets/deferred/ so re-cutting one
     costs a `git mv` and a number. -->

- **Content privacy controls on a public link**, excluding Q&A and anything else a
  course owner would not want a stranger reading. The granularity, the location of the
  control, its default and the read seam were all open, and none of them can be settled
  before 02 says what public discovery is even for. Body:
  [assets/deferred/public-link-privacy-controls.md](assets/deferred/public-link-privacy-controls.md).
  `clears-with: 02`
- **An access and learner-insights dashboard for a course owner.** Deferred because it
  has largely been overtaken from the other direction: the manage route's Users surface
  and Dashboard tab are [ui-overhaul](../ui-overhaul/map.md) tickets 22 and 23, and 23
  is built. Whoever picks this up must diff it against what those shipped before
  treating any of it as missing. Body:
  [assets/deferred/learner-insights-dashboard.md](assets/deferred/learner-insights-dashboard.md).
- **What happens to live pledges when a tenant's donation config is withdrawn.** Named
  inside [04](tickets/04-recurring-monthly-giving.md)'s own Done when, so it is not lost,
  but it is also the one part of recurring giving that is a tenant-switch question as
  much as a payments one. See
  [tenant-feature-modularity/02](../tenant-feature-modularity/tickets/02-what-off-does-to-live-data.md),
  which asks the general form of it.
  `clears-with: 04`
- **Whether the paid marketplace ships from a branch or from `main`.** There is a live
  worktree at `hindi-learning-paid-marketplace` on `feat/paid-marketplace`, and the
  repo's convention is to commit straight to `main`. Deliberately floating: this is an
  operator's call about revenue risk, not a question any ticket here sharpens.

## Out of scope

- **Whether a given tenant may sell, take vouchers or take EFT at all.** Those are
  switches: [tenant-feature-modularity](../tenant-feature-modularity/map.md) tickets 10,
  11 and 12.
- **The `/content` route's open bearer URL**, which is an access defect but an
  architectural one:
  [technical-foundation/04](../technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md).
- **Password recovery and session lifetime**: `technical-foundation/21` and `/08`.
- **The live USD to ZAR rate**: `technical-foundation/13`.
- **Superseding ADR 0016**: `technical-foundation/14`.
- Refunds. ADR 0016's no-refunds posture is the shipped behaviour, and changing it is
  not on any map.
