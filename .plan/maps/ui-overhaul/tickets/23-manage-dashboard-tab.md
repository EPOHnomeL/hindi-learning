---
type: task
blocked_by: [19]
---
# Build the Dashboard tab on the manage route

> `/wayfinder .plan/maps/ui-overhaul/tickets/23-manage-dashboard-tab.md`

## Question

Ticket 16's shell has four peer tabs; the fourth is Dashboard, course-wide, read-only
stats so an owner can track the course at a glance. The operator scoped it on
2026-08-27: published state, people, editors, editions, price. "At least just that
for now", so nothing beyond those five without asking.

**The operator asked on 2026-09-01, and the scope grew.** The Dashboard is now the
owner's real course dashboard rather than a summary rail, and it carries four things
the 2026-08-27 five did not:

1. **Payout for the course**, what this course has earned its owner. Its own ticket,
   [25](25-dashboard-payout-panel.md), because it is money and needs a server-side
   auth path that does not exist yet.
2. **Users per language**, a count per Edition. **This ticket.**
3. **Progress distribution**, all users across all languages bucketed by percentage
   complete (0-10%, 10-20%, and so on). **This ticket.**
4. **Editor progress per language**, a separate table, one row per editor per
   language. Its own ticket, [26](26-dashboard-editor-progress-table.md), because it
   needs the derived status ladder that `translator-status-report` designed.

So this ticket builds the original five stats plus the two people-shaped panels (2
and 3); 25 and 26 land the money and the editor table beside them. All three render
into the same one-column body and are read-only.

It was decided from prototype D3's summary rail (see `assets/manage-shell.md`), not
prototyped as a tab itself, so its interior layout is this ticket's to arrange within
the shell's one-column body.

Use `/tdd` and `/ponytail`.

### What the two new panels have to overcome

`convex/progressCounts.ts` computes **the caller's own** progress for one Topic, and
its comment is explicit that "an owner sees their own progress; a Viewer sees theirs
(fresh on a shared Topic), not the owner's". Neither panel can reuse it:

- **Users per language** is a count of grants per Edition. `shares.listEditionAccess`
  already returns the per-Edition roster the Users tab renders, so a count is cheap,
  but it is one query per Edition today and a fourteen-language course would fire
  fourteen. One course-wide query is likely the right shape.
- **The bucket histogram** is a new aggregate over `progress` for every reader of
  every Edition, and it is the read-amplification question on this ticket, not a UI
  one: lessons by readers by editions, scanned on every dashboard open. Decide the
  bucket edges too. Ten buckets of 10% is the operator's example, but 0% and 100% are
  the two an owner actually acts on and they may deserve to be their own.

## Todo

- [x] Add the Dashboard tab to the shell ticket 19 ships, with its icon: none of the
      existing `icons.tsx` paths fits, so add one (SVG, never emoji), same stroke
      style as the rest.
- [x] Render the five original stats from queries that already exist where possible;
      a new query needs the owner check server-side.
- [x] Users per language: one count per Edition, from one course-wide query rather
      than one query per Edition.
- [x] Progress buckets across all Editions' readers, with the bucket edges chosen
      here and the choice recorded in the Answer.
- [x] Leave room in the layout for 25's payout panel and 26's editor table; do not
      build either here.
- [x] Read-only. No control lives here; each stat may link to the tab that owns it.
- [x] Copy through the message namespaces, no hardcoded English.
- [x] Read the `dataviz` skill before writing any chart or bucket meter.
- [x] `pnpm typecheck` green.
- [x] Walk it in a browser at phone width.

## Done when

Every box above is ticked and the Answer records that the tab was walked in a browser
at phone width rather than only read, states the bucket edges chosen and why, and
names the shape of the progress aggregate so 25 and 26 can follow it.

## Answer

Built, walked and accepted. The Dashboard tab is the fourth peer on the manage
route: five stats over a users-per-language panel and a progress histogram, all
read-only, all fed by ONE owner-gated query.

Shipped in `19c05b3` (the query and its tests) and `0500c03` (the tab), both
2026-09-01. `pnpm typecheck` clean, 995 tests passing at the time of the build.

### Evidence: walked in a browser at phone width

The operator opened the tab in a browser at phone width and accepted it on
2026-09-03. That is a real walk, not a code read, which matters here: the build
session could not reach one (nothing was listening on port 3000, and the manage
route needs a signed-in owner), so the ticket was deliberately held open, claimed
and answerless, for two days waiting on exactly this.

The bucket edges were the thing put in front of the operator to react to, and
they stand as built.

### The bucket edges, and why seven and not ten

`PROGRESS_BUCKETS` in `convex/dashboard.ts:30`: `0` exact, `1-20`, `20-40`,
`40-60`, `60-80`, `80-99`, `100` exact.

Seven, not the ten-of-10% the Question sketched, for three reasons:

- **0% and 100% are the only two rungs an owner acts on** (nudge the untouched,
  congratulate and certificate the finished), so each is its own exact bucket and
  is never diluted by a neighbour merely near it.
- **Seven rows read at 360px; twelve do not.** The manage route is phone first.
- **100 compares lesson COUNTS, never a rounded percentage** (`progressBucket`,
  `convex/dashboard.ts:38`), so 99.6% cannot present as finished in the bucket
  Certificates are minted from.

The five interior bands are half-open `[lo, hi)` and 20 points wide. The keys are
stable strings and the array order is the render order; the client maps a key to
its label and nothing infers an edge from a name.

### The shape of the progress aggregate, for 25 and 26 to follow

`dashboard.courseStats({ topicSlug })` is one owner-gated query for the whole
tab, and it is course-wide on purpose: the obvious draw was
`shares.listEditionAccess`, which is per Edition, so a fourteen-language course
would have fired fourteen queries to paint one panel.

It returns only what the client cannot already derive. `translate.editions` is
already loaded by `ManageShell` and carries the edition list and each Edition's
published flag, so the "editions" and "published" stats are counted client-side,
not here. The server supplies the access rows, the prices and the histogram.

The histogram itself is **one indexed range read** over `by_topic_user_lesson` at
`topicId`, every reader's every row for this course, grouped by reader in memory.
That is readers x lessons documents on every dashboard open, and it is capped:
past `PROGRESS_SCAN_CAP` (8192, `convex/dashboard.ts:58`) the query **refuses to
guess**, returning `truncated: true` and no buckets rather than a histogram
computed from a partial scan that would silently under-count every reader the
scan cut off. A denormalised per-reader counter is the fix if a real course ever
trips it; nothing is close today (ticket 14 counted 68 Shares across 14 courses).

**Panels 25 and 26 should ride this query, not add their own.** The `progress`
scan is the dashboard's dominant read and is already in hand, so a second
owner-gated query over the same documents would double it for nothing. 26 did
exactly that (`editorRows` is a field on `courseStats`,
`convex/dashboard.ts:81`), and 25's payout should follow unless the money path
genuinely needs its own auth boundary.

### One box that was already ticked when the build session opened

The first Todo box asked for a Dashboard icon. There was none to add: ticket 19
had already wired the Dashboard peer into the `tabs` array and added the `chart`
icon (`src/app/_components/icons.tsx:129`) on 2026-08-27. Only the placeholder in
the `main` block was left to replace. The box's premise was stale, not the box.

### What is not on this tab

Payout (ticket 25) is still unbuilt. The editor-by-language table (ticket 26)
landed on 2026-09-01 in `c748d08` and sits at the foot of this body.
