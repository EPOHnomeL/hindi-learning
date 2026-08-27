---
type: prototype
blocked_by: [15]
---
# Modal, sheet or route, and the phone-first Editions layout inside it

> `/wayfinder .plan/maps/ui-overhaul/tickets/16-management-shell-prototype.md`

## Question

Every act of managing a course happens in one `max-w-lg` `Dialog` with nine concerns
in a flat scroll, two `sm:` classes and no `md:` at all. On a phone that is a column
of cards you scroll past to reach the one you want.

Prototype the container and the layout together, because the container only makes
sense once you can see what it holds. Three candidates at 360px:

1. **Dialog stays**, rails become sections behind a disclosure, one open at a time.
2. **Bottom sheet**, sitting with the app-level tab bar that shipped 2026-08-23 (see
   `assets/mobile-bottom-nav.md`).
3. **A route**, `/courses/[slug]/manage`, edition picker as its header. The ask leans
   here. What then stays on the dashboard card is fog on the map, not this ticket's.

Design for the common owner: one course, one or two languages, publishes it, shares a
link, maybe sets a price. Vouchers, seller setup and payout details are the rare path
and may cost a tap. The 20-edition picker still has to work, but it stops being the
thing the layout is built around.

**What ticket 15 handed down.** Three groups, in order: Who can find it (Publish
alone), Who you hand it to (Public link, Invite, the access roster), What it costs
(Price plus one voucher control). Group three collapses to one row saying selling is
off unless the owner is a ready Seller, with the seller grant and payout details
inside that row.

**What 15 left to you** is how a group is drawn: heading or accordion, one open at a
time or all open, and where the group boundary is visible at 360px. The merged voucher
card is the stress case, since it carries a mode picker plus two lines of billing and
identity consequence, and it is on the rare path.

Use `/prototype` and throwaway code. Reuse real queries where cheap, fake them where
not. Mobbin references if 01 and 02 have landed, otherwise proceed and say so.

## Done when

At least two candidates are committed under `assets/` and reachable in a browser, the
Answer names the winner with the reason, and the layout works at 360px with no
horizontal scroll and every common control within two folds. The Answer also names the
seams `Editions.tsx` splits along, which is the Editions half of ticket 06.
