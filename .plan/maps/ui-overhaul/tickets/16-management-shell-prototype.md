---
type: prototype
blocked_by: [15]
---
# Modal, sheet or route, and the phone-first Editions layout inside it

> `/wayfinder .plan/maps/ui-overhaul/tickets/16-management-shell-prototype.md`

## Question

Today every act of managing a course happens in one `max-w-lg` `Dialog` with nine
concerns stacked in a flat scroll, two `sm:` classes and no `md:` at all. On a phone
that is a single column of cards you scroll past to reach the one you want.

Prototype the container and the layout together, because the container only makes
sense once you can see what it holds. Three candidates worth building at 360px:

1. The dialog stays, and the rails ticket 15 kept become sections behind a
   disclosure, one open at a time.
2. A bottom sheet, sitting with the app-level bottom tab bar that shipped on
   2026-08-23 (see `assets/mobile-bottom-nav.md`).
3. A route, `/courses/[slug]/manage`, with the edition picker as its header. This is
   the option the ask leans toward. It also raises the question of what stays on the
   dashboard card, which is fog on the map, not this ticket's to settle.

Design for the common owner: one course, one or two languages, publishes it, shares a
link, maybe sets a price. Vouchers, seller setup and payout details are the rare path
and may cost a tap. The 20-edition picker still has to work, but it stops being the
thing the layout is built around.

Use the `/prototype` skill and throwaway code. Reuse the real queries where it is
cheap, fake them where it is not. Mobbin references via the MCP if tickets 01 and 02
have landed by then, otherwise proceed without them and say so.

## Done when

A prototype of at least two candidates is committed under `assets/` and reachable in a
browser, the Answer names the winner with the reason, and the layout is settled at
360px with no horizontal scroll and every common control reachable without a scroll
past two folds. The Answer also states which seams `Editions.tsx` splits along, which
is the Editions half of ticket 06's god-file question.
