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

What ticket 15 handed down, on 2026-08-27, and what it did not. The layout holds
three groups, in this order: **Who can find it** (Publish alone), **Who you hand it to**
(Public link, Invite, the access roster), **What it costs** (Price, plus one voucher
control). Group three is one collapsed row saying selling is off unless the owner is a
ready Seller, and the seller grant and payout details live inside that row rather than
inside the price card. What 15 left to this ticket is everything about how a group is
drawn: heading or accordion, one open at a time or all open, and where the group
boundary is visible at 360px.

One new form arrives with it. The two voucher rails are now one card with a mode
picker on distribution, "one shared code" against "one code each", and each mode has
to state its billing and its identity consequence in a line. That is the densest thing
on the surface and it is on the rare path, so it is the prototype's stress case for
whatever disclosure the container uses.

Use the `/prototype` skill and throwaway code. Reuse the real queries where it is
cheap, fake them where it is not. Mobbin references via the MCP if tickets 01 and 02
have landed by then, otherwise proceed without them and say so.

## Done when

A prototype of at least two candidates is committed under `assets/` and reachable in a
browser, the Answer names the winner with the reason, and the layout is settled at
360px with no horizontal scroll and every common control reachable without a scroll
past two folds. The Answer also states which seams `Editions.tsx` splits along, which
is the Editions half of ticket 06's god-file question.
