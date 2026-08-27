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

## Working notes

**Not yet decided, reopened 2026-08-27.** A first pass through this ticket wrote real
prototype code into `src/app/_components/` and a real throwaway route under
`src/app/(app)/courses/[slug]/`, then picked a winner from the prototype's own
description rather than the operator ever seeing or approving it. Both are wrong for a
HITL prototype ticket: the code has been deleted (never should have landed on disk
without sign-off, per the correction now in CLAUDE.md), and the "decision" is void.

**Ticket 17 resolved while this ticket was claimed** and moved the access roster off the
per-Edition sharing panel onto its own course-scoped Users surface. See the map's Notes
for what that hands to whoever prototypes this next: the container must hold at least
three peers at two scopes, Sharing per Edition, Users and Course settings course-wide,
the edition picker governing only the Sharing peer.

Next attempt: show the operator something real (an Artifact, or a prototype they can
open themselves) **before** writing any of it into the repo, and only write to `assets/`
once they have actually looked at it and picked.

## Answer

**A route at `/courses/[slug]/manage`, laid out as R1 phone plus D1 desktop, with a
fourth Dashboard tab.** Decided 2026-08-27 by the operator walking an interactive
Artifact through seven rounds of reaction; the full round history, every rejected
alternative and the walkable prototype live in
[assets/manage-shell.md](../assets/manage-shell.md) and
[assets/manage-shell-prototype.html](../assets/manage-shell-prototype.html).

The shell, at both widths:

- Header of two rows. Title row: back, "Manage course", and an edition button naming
  the current edition, which opens a sheet (phone) or centered dialog (desktop)
  listing every edition with ticks. Under it one underlined tab row. No chips in the
  header; a one-edition course shows no edition button at all. This is what killed
  the accepted-but-clunky chip row: two horizontal control rows stacked in one header.
- Four peer tabs, each with an icon: Sharing (globe), Users (users), Course settings
  (book), Dashboard (needs a new icon in `icons.tsx`; SVG, never emoji). Sharing is
  per edition and is the only tab the edition button shows on. The other three are
  course-wide.
- Dashboard is read-only course stats (published state, people, editors, editions,
  price), just that for now. The operator added it after seeing prototype D3's pinned
  summary rail and choosing the stats over the rail. It is the one piece decided
  without being prototyped as a tab; ticket 23 builds it and can adjust its interior.
- Sharing tab: ticket 15's groups in order as plain scrolling sections with small-caps
  labels. A non-seller sees one "Selling is off" row whose Turn on runs a two-step
  sheet, payout details then price. The voucher card carries the mode picker with both
  consequence lines and mints a copyable code.
- Desktop is the phone given room: same header stretched, one centered column of about
  600px, sheets become dialogs. The operator rejected a three-column grid, a sidebar,
  and the rail.
- Flows are part of the decision: toasts confirm publish and link toggles, invites
  land as revocable awaiting rows visible in Sharing and Users both.

**The seams `Editions.tsx` (2023 lines, 21 components) splits along**, for ticket 19,
which is also the Editions half of ticket 06:

1. **The shell**: a new route page owning the header, the edition sheet and the tab
   row. `EditionsDialog` dissolves into it; `EditionPicker` becomes the edition sheet.
2. **The Sharing tab**: `PublishToggle` (group one); `PublicLinkToggle` and
   `InviteByEmail` (group two); `SellEdition` and `PayoutDetailsForm` plus one merged
   voucher card replacing the six voucher components (`VoucherBatches`,
   `MintBatchForm`, `BatchRow`, `AccessCodes`, `MintAccessCodeForm`,
   `AccessCodeRow`) per ticket 15.
3. **The Users tab**: `AccessRoster` and `AccessRow` leave for the course-scoped
   surface, ticket 22's build.
4. **The Course settings tab**: `TeacherQaToggle`, `AddLanguagePanel`,
   `EditionDangerMenu` with its three confirms, `RetryTranslation`, `RemoveEdition`,
   `EngineToggle`. Its interior is ticket 18's design and ticket 20's build.
5. **The Dashboard tab**: new code, ticket 23.

**Evidence: walked in the published Artifact**, interactive at 360px and desktop
width, seller and 20-edition stress cases toggled. Not walked in the app; no app code
for this shell exists yet.
