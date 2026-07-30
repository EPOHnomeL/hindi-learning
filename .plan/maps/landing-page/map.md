# Landing page

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The landing page markets the paygate accurately — an Edition is what gets sold, the first
Lesson is a free Preview, purchase grants a lifetime Entitlement — and it ships only once the
paid marketplace is actually live.

## Notes

- **Ticket 01 of this effort (the marketing landing page itself) already shipped** and is not
  present as a file; numbering starts at 02 because `NN` is a permanent identity.
- **Accuracy is the constraint, not copywriting.** ADR 0016 fixes the facts: Edition-grain
  sale, free first-Lesson Preview, lifetime Entitlement, Stripe Connect facilitator with the
  Seller as merchant of record, 15% platform fee (`PLATFORM_FEE_BPS=1500`), and **no refunds**
  — so do not market a refund policy.
- **Selling is a two-gate capability:** an Admin grants can-sell, then the Seller completes
  onboarding. Only completed and published courses can be priced. Marketing copy that implies
  one-click selling is wrong.
- **Hard gate:** the section stays behind a flag or omitted until the paid-marketplace work is
  on `main`. Never market a feature that is not live.
- Per-tenant landing pages already exist (`src/app/_landing/registry.ts`) — decide whether
  this section is one shared block or per-tenant.
- Adjacent: [marketplace-discover/01](../marketplace-discover/tickets/01-marketplace-discover-component.md)
  (the actual course listing) and
  [onboarding-video/01](../onboarding-video/tickets/01-scope-onboarding-and-marketing-video.md)
  (a demo would plausibly live on this page).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- The paygate mechanics themselves — ADR 0016 and the paid-marketplace work own those.
