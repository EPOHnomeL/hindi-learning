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

## Answer

Decided 2026-08-27. Built all three candidates as one prototype,
`src/app/_components/EditionsManagementPrototype.tsx`, mounted at the throwaway route
`/courses/[slug]/manage-prototype?variant=A|B|C` (`page.tsx` beside it, write-up at
`assets/management-shell-prototype.md`). Real reads: `api.translate.editions`,
`api.sellers.sellerStatus`. Every toggle, the invite field, the roster and the price and
voucher mode are local state, not real mutations, per the prototype skill's read-only
rule. The operator reviewed all three and picked the winner below.

**Corrected mid-session.** Ticket 17 resolved while this ticket was claimed and moved the
access roster off the per-Edition sharing panel onto its own course-scoped Users surface,
leaving a note in the map's Notes rather than this ticket's body because the claim was
live. That changed the shape the container has to hold: at least three peers at two
scopes, Sharing per Edition, Users and Course settings course-wide, the edition picker
governing only the Sharing peer. Variant C was reworked to a top-level peer nav before
this answer was written; the winner and the layout verdict below already reflect it. The
roster does not appear in "Who you hand it to" for that reason.

### The winner is C, a route

`/courses/[slug]/manage`, a top-level Sharing / Users / Settings peer nav, with the
edition picker and ticket 15's three groups appearing only under Sharing. This was the
ticket's own prior going in, and it held up against the other two once built, now for a
shell that has to hold three peers rather than one panel:

- **No dialog stacking.** A owns a `<dialog>` element already nested inside whatever
  opened it (the dashboard card, or the reader drawer on the Editor's door ticket 18
  names). C is a destination, not a layer, which matters more once it has to hold three
  peers rather than one.
- **Deep linkable and reload stable**, the same property that decided Settings as a route
  over a sheet on 2026-08-23 (`assets/mobile-bottom-nav.md`). A support conversation about
  a course's Users list can now link straight to it, not just to Sharing.
- **The sub-nav survives scroll**, which neither A nor B's chrome gives for free. A's
  accordion only shows the open group, so there is no "where am I" signal once a group is
  long (the merged voucher card, the stress case, runs to five interactive pieces). C's
  sticky segmented control stays visible while `What it costs` scrolls under it, and the
  same sticky header holds the peer nav above it.
- **B's docking below the app tab bar cost more real estate than it bought**, and gets
  worse once a third peer is added. Two bars stacked (tab bar plus sheet header plus sheet
  sub-nav) already left less body height than A or C at 360px before Users existed as a
  destination; a peer nav on top of that leaves too little room to read.

### Layout: within two folds, no horizontal scroll at 360px

Under Sharing, a fixed-width edition picker strip (horizontally scrollable inside its own
row, so it never widens the page) sits over three groups. `Who can find it` (Publish, one
row) is on screen without scrolling, under the sticky header; `Who you hand it to` (Public
link, Invite) is the first scroll; `What it costs` is the second, whether that is the
ready-Seller price-plus-voucher pair or the single collapsed "Selling is off" row. Users
and Settings sit one peer-nav tap away and carry no picker. Nothing in any row wraps or
grows past 360px, since every control is `flex` with `min-w-0` on its text and a
`shrink-0` control, the same pattern the current rails already use.

### Seams `Editions.tsx` splits along (ticket 06's Editions half)

`EditionPanel`'s six-card flat scroll (`Editions.tsx:298-322`) becomes:

| Destination | Carries | Source today |
| --- | --- | --- |
| Route shell, sticky header | Peer nav (Sharing, Users, Settings), and under Sharing only: `EditionPicker`, `EditionBadges`, the add-language flow, the 3-way sub-nav | `EditionsDialog`, `EditionPicker`, `EditionBadges` (unchanged) |
| Sharing, Who can find it | `PublishToggle` alone | `PublishToggle` (unchanged) |
| Sharing, Who you hand it to | `InviteByEmail`, `PublicLinkToggle` | `InviteByEmail`, `PublicLinkToggle` (unchanged) |
| Sharing, What it costs | The seller gate collapsed to one row, `SellEdition`'s price control, one merged Voucher control with a distribution-mode picker | `SellEdition`, `PayoutDetailsForm`, `VoucherBatches`, `MintBatchForm`, `AccessCodes` (merge is ticket 15's decision; ticket 19 builds it) |
| Users peer, course-wide | The access roster, language as a row attribute | `AccessRoster`, `AccessRow`, moved out of `Editions.tsx` entirely (ticket 17, built by ticket 22) |

`TeacherQaToggle` is not in this table. It renders inside `EditionPanel` today but ticket
17 already placed it on Course settings as a course-wide switch, so it leaves
`Editions.tsx` entirely rather than landing in a Sharing group.

### What this does not decide

Ticket 19 builds the Sharing peer for real; ticket 22 builds Users; ticket 20 builds
Course settings, whose layout is ticket 18's prototype (blocked on ticket 17), landing as
the shell's third peer rather than its own surface. Nothing here is wired to a mutation.

Two fog patches this answer clears:

- What the dashboard card carries once Editions & sharing is a route rather than a dialog
  open, and now a shell with three destinations rather than one:
  [What the dashboard card carries once sharing is a route](23-dashboard-card-after-route.md).
- Where the Users surface ticket 17 named sits inside the container ticket 16 chose:
  answered above (a peer of Sharing, course-wide, no picker), which is the fact ticket 22
  was left to obey rather than revisit.
