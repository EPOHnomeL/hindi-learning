---
type: task
blocked_by: [19]
claimed_by: dashboard-tab-build-2026-09-01
claimed_at: 2026-09-01T11:08:02+02:00
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
- [ ] Walk it in a browser at phone width.

### Where it stands (2026-09-01)

Built and committed: `19c05b3` (the query and its tests), `0500c03` (the tab).
The first box was already satisfied when this session opened, and its claim is
stale: ticket 19 wired the Dashboard peer into the `tabs` array and added the
`chart` icon (`src/app/_components/icons.tsx:129`) on 2026-08-27, so there was no
icon to add. Only the placeholder in the `main` block was left to replace.
`pnpm typecheck` clean, 995 tests pass. **The browser walk has NOT happened**,
which is why this ticket is still claimed and has no Answer: nothing was
listening on port 3000 in the build session, and the manage route needs a
signed-in owner, so no walk was reachable. Reading the code is not the claim
this ticket's Done-when asks for.

To finish it: `pnpm dev`, open `/courses/<slug>/manage` at 360px, press the
Dashboard tab, and react to the bucket edges (below). Then the Answer lands.

**The bucket edges chosen, which are the thing to react to.** Seven buckets, not
the ten-of-10% the Question sketched: `0` exact, `1-20`, `20-40`, `40-60`,
`60-80`, `80-99`, `100` exact. 0% and 100% are the two rungs an owner acts on,
so neither is diluted by a neighbour merely near it, and seven rows read at
360px where twelve do not. 100% compares lesson COUNTS, never a rounded
percentage, so 99.6% cannot present as finished in the bucket Certificates are
minted from. They live in `PROGRESS_BUCKETS` in `convex/dashboard.ts`.


## Done when

Every box above is ticked and the Answer records that the tab was walked in a browser
at phone width rather than only read, states the bucket edges chosen and why, and
names the shape of the progress aggregate so 25 and 26 can follow it.
