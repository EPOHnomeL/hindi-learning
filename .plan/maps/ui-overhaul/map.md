# UI/UX overhaul

## Destination

A spec (`spec.md` here) for an agent-driven UI/UX overhaul of both learner-facing and
authoring surfaces: visual polish, flow fixes, and mobile experience, grounded in
Mobbin MCP references, foundation first. Done when every decision needed to open a
sibling `ui-overhaul-impl` map is resolved, and when the course-management strand
(tickets 14 to 22) has shipped its three rebuilt surfaces. This effort runs **before**
the [reader-experience](../reader-experience/map.md) effort resumes.

## Notes

- Grilled 2026-08-01. The problem is all three of: visual polish ("looks amateur"),
  clunky flows, weak mobile. Scope is **learner plus authoring**, the whole app.
- **Stack facts.** Next.js 15, React 19, Tailwind v4, **no component library**; the UI
  is hand-rolled. The app is **whitelabeled** per tenant, so any foundation must keep
  tenant theming expressible.
- **Foundation first.** The design-system decision (ticket 03) lands before any general
  surface redesign ticket opens.
- **References come via the Mobbin MCP** (`api.mobbin.com/mcp`, paid, beta). Decided:
  buy Pro monthly, validate on one real surface, switch to yearly if it earns its keep.
- **Volume reality.** Lifetime sales are around **ten**. Funnel percentages are
  statistically meaningless here; the value is replay, few enough to watch every
  session. Any ticket reasoning from a drop-off *rate* is reasoning from noise.
- **Measurement strand, grilled 2026-08-02** (tickets 07 to 13). PostHog Cloud **EU**,
  one project with `tenant` as property and group, product analytics plus session
  replay, no surveys or flags or experiments. **No consent banner**: POPIA legitimate
  interest, carried by aggressive masking (09) and a privacy disclosure (11), which is
  a hard precondition for replay in prod. `identify()` sends the **Convex user id
  only**. Browser `posthog-js` plus `posthog-node` in the ITN handler, since purchase
  truth lands server-side and asynchronously.
- **Course-management strand, charted 2026-08-27** (tickets 14 to 20). The two owner
  surfaces get redesigned *and* rebuilt here, ahead of ticket 03, because they are
  unusable on a phone now and 03 has not started. Settled when the strand was charted,
  so no ticket relitigates it: the strand may argue a rail should merge or disappear
  rather than only look better; it designs for the common owner on a phone (one course,
  one or two languages, a link and maybe a price, vouchers and seller setup on the rare
  path); and it runs ahead of 03 and 06 knowingly, with whatever primitives it proves
  becoming input to those tickets. The surfaces are the Editions and sharing dialog
  (inventory rank 3) and the course settings dialog (rank 13).
- **This map carries build tickets, and says so here because wayfinder plans by
  default.** Two stated exceptions, both split from the decisions they carry out so a
  resolved decision never reads as shipped: tickets **07, 08, 10 and 11** provision and
  wire PostHog, because ticket 13 cannot be decided without real usage data and the data
  does not exist until instrumentation ships; tickets **19, 20 and 22** build the three
  course-management surfaces. Same shape as ticket 01 buying Mobbin. Nothing else here
  builds.
- **Input for ticket 16, which was claimed when ticket 17 resolved.** 17 sent the access
  roster to a course-scoped Users surface and Teacher Q&A to Course settings, so the
  container 16 chooses must hold at least three peers at two scopes: sharing is per
  Edition, Users and Course settings are course-wide. The 20-Edition picker therefore
  governs one peer rather than the shell. 17 declined to add a blocking edge and left the
  shape, and the picker's placement, entirely to 16. This note exists rather than a line
  in 16's body because `sonnet5-ui-overhaul-16` held the claim.
- **Task tickets carry a `## Todo` checklist**, the shape
  [mobile-reader-todos](../mobile-reader-todos/map.md) uses. Tick items as they land,
  but the `## Answer` is still what resolves the ticket. Decision tickets carry a
  question and no checklist.
- **Refactored 2026-08-27.** Every ticket was cut back to its sharp question, the seven
  do-not-decide tickets became `## Todo` checklists, and **ticket 12 was ruled out as
  ceremony**: its bar (watch every recorded session in the two weeks after 10 ships) and
  its stop rule moved into ticket 13's Done-when, which is now `blocked_by: [08, 10]`.
- Skills: `/grilling`, `/prototype`, `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

- [Build the reorganised sharing surface](tickets/19-build-editions-sharing.md):
  **shipped.** `/courses/[slug]/manage` is live with the four-tab shell, ticket 15's
  three groups, the merged voucher card and ticket 17's moves; `EditionsDialog` and
  `Editions.tsx` are deleted, every query and mutation untouched. Walked headless at
  360px on a dev course through the full seller loop (turn-on, price, mint, stop);
  screenshots in `assets/manage-walk/`. Unblocks tickets 20, 22 and 23.
- [Modal, sheet or route, and the phone-first Editions layout inside it](tickets/16-management-shell-prototype.md):
  **a route at `/courses/[slug]/manage`, one shell at both widths.** Two-row header,
  back plus an edition button that opens a sheet, over one underlined tab row of four
  iconed peers: Sharing (per edition), Users, Course settings, and a read-only
  Dashboard stats tab the operator added from prototype D3's rail. Desktop is the same
  header over one centered column, no grid, no sidebar. The operator walked the
  interactive artifact through seven rounds; record and prototype in
  `assets/manage-shell.md`. The Answer names the `Editions.tsx` seams ticket 19 was
  waiting on; tickets 23 (Dashboard tab) and 24 (dashboard card) came out of it.
- [Which controls belong to sharing, which to course settings, which to the account](tickets/17-control-boundary.md):
  **three controls move, not four, and nothing goes to `/settings`.** Teacher Q&A goes to
  Course settings, losing the `source`-tab guard and the two-line disclaimer that only
  existed to apologise for its placement. The access roster leaves the per-Edition panel
  for a **course-scoped Users surface**, language as a row attribute, Editor assignable
  only to someone already shared with. The seller grant and payout form **stay** inside
  the collapsed price row: ticket 15 wins over this ticket's own prior. Lesson deletion
  and the lifecycle stay in Course settings with their arrangement deferred to 18. The
  fourth finding was that an Editor sees **nothing** today, not "Details only":
  `e228ba5` (2026-08-23) removed the reader's door and the `owner={false}` branch has been
  dead code since, so the door returns in the reader.
- [Which of the six share and sell rails survive, and what does the owner call them](tickets/15-which-rails-survive.md):
  **nothing is retired.** Three groups, each a question: Who can find it (Publish alone,
  because publishing is orthogonal to price), Who you hand it to (Public link, Invite,
  roster), What it costs (Price plus one voucher control, collapsed to one row for
  anyone who is not a ready Seller, with the seller grant and payout details moved
  inside it). The two voucher rails merge into **one** card whose mode picks
  distribution, one shared code against one code each, with billing and the identity
  difference stated per mode. Four owner-facing words survive: Publish, Public link,
  Invite, Voucher. Batch and access code go.
- [Which share and sell rails has anyone actually used](tickets/14-rail-usage-evidence.md):
  the dialog has **six** rails, not seven; one course (`prophetic-school`) carries every
  one of them and is the only Topic that ever earned money (17 paid seats, 14 PayFast
  and 3 EFT). Vouchers have never been used outside `test-course` and `enrollments` is
  empty, while the widely-used public-link rail is the legacy `topics.publicToken`
  (19 Topics) rather than `publicLinks` (3).
- [Surface inventory and priority order](tickets/04-surface-inventory.md): 21 surfaces
  ranked worst-first; no design system exists (6 theme toggles, 7 confirm dialogs,
  `PublicReader` is a fork of `CourseShell`), the lesson quiz lives outside React in an
  iframe, and **no PWA has shipped** despite the pwa map assuming otherwise.

## Not yet specified

- **What the Dashboard tab becomes once the owner actually reads it.** The operator
  widened it on 2026-09-01 from the 2026-08-27 five stats to a real course dashboard:
  payout, users per language, a progress-percentage histogram over all readers, and a
  separate editor-by-language table. Tickets 23 (the tab, users per language, buckets),
  25 (payout) and 26 (the editor table) carry it, and the
  [translator-status-report](../translator-status-report/map.md) map was redirected the
  same day, four of its tickets ruled out, because that report is now this tab. What is
  not specified is what a **fifth** thing on this tab would be, and at what point four
  panels in one 640px column stops being a glance and starts needing its own layout
  decision. clears-with: 23
- **Per-surface redesign directions**, one direction ticket per surface, in the
  inventory's priority order, cut once the foundation and the collapse plan exist.
  Two surfaces left this patch on 2026-08-27 and became tickets 14 to 20, the Editions
  and sharing dialog (ranked 3rd) and the course settings dialog (13th), pulled forward
  ahead of the foundation because they are unusable on a phone today. The other 19
  surfaces still wait here. clears-with: 06
- **Flow fix directions**, what the clunky journeys should *become*, one patch per flow
  once they are named. The "which journeys are clunky" half graduated on 2026-08-02 into
  the PostHog strand: ticket 13 names and ranks the flows from replay. What remains here
  is the redesign direction for each, which cannot be written until there is a ranked
  list to write it against. clears-with: 13
- **Mobile-readiness bar**, what "good on a phone" means per surface, and the single
  breakpoint scale to replace the current `md:`-only ad-hockery. Feeds the
  reader-experience effort that follows. One anchor exists (2026-08-23): the app-level
  bottom tab bar shipped, with the prototype record and verdict in
  [assets/mobile-bottom-nav.md](assets/mobile-bottom-nav.md), including the open
  question of what the in-course lesson list becomes underneath it, which belongs to
  this patch. clears-with: 03
- **Spec assembly**, folding the resolved decisions into `spec.md` and charting
  `ui-overhaul-impl`. The last patch to clear.

## Out of scope

- [Set the evidence bar](tickets/12-set-evidence-bar.md): ruled out 2026-08-27 as
  ceremony. At around ten lifetime sales there is exactly one defensible bar, and it
  needs no separate ticket to reach: watch every session. Its bar and stop rule moved
  into ticket 13's Done-when.
- PWA and offline itself: the [reader-experience](../reader-experience/map.md) map; this
  effort only precedes it. Ticket 04 found its "groundwork already closed" premise is
  false; correcting that belongs to that map.
- Missing i18n coverage surfaced by the inventory (`AdminPanel.tsx` and `YwamPotch.tsx`
  have zero translation calls; the legal pages are English-only):
  [app-language-i18n](../app-language-i18n/map.md).
- Whitelabel leaks surfaced by the inventory (legal pages hardcode "My Course" and
  `support@my-course.app`): [whitelabel](../whitelabel/map.md).
- Tearing down the backend of any rail the UI retires. **That verdict never landed**
  (2026-08-27): ticket 15 retired no rail, so nothing is owed a teardown and neither ADR
  0029 nor ADR 0031 needs superseding. The line stays because the boundary still holds
  for whatever the strand argues later.
- What the access roster should grow into, plus the share-management edge cases and the
  learner insights view. Ticket 17 decides only where the roster lives; the depth is
  [topic-sharing](../topic-sharing/map.md) tickets 06, 08 and 09.
- Session lifetime: [auth-sessions](../auth-sessions/map.md).
