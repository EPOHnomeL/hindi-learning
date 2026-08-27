# Management shell: the prototype record and its verdict

**Status: resolved (2026-08-27).** Ticket 16's record. The winning shell is R1 on the
phone and D1 on the desktop, plus a Dashboard tab the operator added after seeing D3.
Nothing is built; ticket 19 builds it. The full interactive prototype, every variant
and every flow, is [manage-shell-prototype.html](manage-shell-prototype.html), a
self-contained page that opens straight from disk. It was published as a Claude
Artifact during the sessions
(<https://claude.ai/code/artifact/5dfe9b0f-4caa-4371-a357-e4dc73690a61>); the file
here is the same page.

## Question

Every act of managing a course happened in one `max-w-lg` dialog with nine concerns in
a flat scroll. What container replaces it, and what layout does that container hold at
360px, given ticket 15's three groups and ticket 17's three peers at two scopes?

## How the rounds went

1. **Container.** Dialog, bottom sheet and route were the candidates. The operator
   ruled early: "I always want a seperate rout". Route, settled.
2. **First layout artifact.** A filled pill bar for the peers stacked on a second pill
   bar for the groups, edition picker between them. Rejected: "the layout and tabs on
   tabs is not okay". Three nav-looking rows in one header.
3. **The redo.** One underlined tab row (Sharing / Users / Settings), groups as plain
   scrolling sections with small-caps labels, edition picker as quiet bordered chips.
   Accepted as a direction: "yeah i like that". Became the baseline to beat.
4. **Three structural alternatives** (hub and drill-down, one document with a
   scroll-spy strip, state-sentence-first accordion) shown beside the baseline. The
   operator kept the baseline's tab row but called the phone experience weak.
5. **Three refinements of the tab row**, flows now fully walkable. R1 moved the
   edition picker out of the header into a title-row button opening a bottom sheet.
   R2 led the Sharing tab with a state sentence. R3 kept the approved chips and folded
   them away on scroll. **The operator picked R1.**
6. **Desktop, first try.** One take: single-row header, the three Sharing groups side
   by side in a grid, sheets as centered dialogs. Rejected flat: "I dont like the
   desktop layout".
7. **Desktop, three takes.** D1 one calm centered column under the stretched phone
   header. D2 the peers as a left icon rail. D3 the column plus a pinned summary rail
   stating what is true right now. **The operator picked D1 and kept D3's idea**: the
   stats become a fourth tab named Dashboard instead of a rail.

## Verdict

The manage route is `/courses/[slug]/manage`. One shell at both widths:

- **Header, two rows.** Title row: back button, "Manage course", and an edition
  button naming the current edition, which opens a bottom sheet (phone) or centered
  dialog (desktop) listing all editions with ticks. Below it one underlined tab row.
- **Four peer tabs, each with an icon:** Sharing (globe), Users (users), Course
  settings (book), Dashboard (new icon needed in `icons.tsx`; SVG, never emoji).
  Sharing is per edition and is the only tab the edition button appears on; the other
  three are course-wide. Dashboard holds course stats (published state, people,
  editors, editions, price), read-only, just that for now. It was decided from D3's
  rail, not prototyped as a tab; ticket 23 builds it.
- **Sharing tab content**: ticket 15's groups in order as plain scrolling sections.
  Publish; Public link and Invite; Price plus the merged voucher card. A non-seller
  sees one "Selling is off" row whose Turn on opens the two-step onboarding sheet
  (payout details, then price).
- **Desktop is the phone given room**: same header stretched full width, content in
  one centered column of about 600px, sheets become centered dialogs. No grid, no
  sidebar, no rail.
- **Flows accepted as part of the design**: publish and link toggles confirm with a
  toast; invites go through a sheet and land as revocable awaiting rows visible in
  both Sharing and Users; vouchers pick a mode (one shared code against one code
  each, each stating its billing and identity consequence) and mint a copyable code.

Rejected along the way: dialog and bottom-sheet containers, stacked pill bars, the
hub, the long document, the accordion, header chips (both always-visible and
fold-on-scroll), the desktop grid, the sidebar, and the summary rail as a rail.

**Evidence: the operator walked the interactive artifact**, at 360px and at desktop
width, through several rounds of reaction. Nothing was walked in the app; no app code
exists for this shell yet.
