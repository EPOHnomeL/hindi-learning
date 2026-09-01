---
type: task
blocked_by: [23]
claimed_by: editor-progress-table-2026-09-01
claimed_at: 2026-09-01T15:52:55+02:00
---
# The editor progress table on the course Dashboard

> `/wayfinder .plan/maps/ui-overhaul/tickets/26-dashboard-editor-progress-table.md`

## Question

The operator decided on 2026-09-01 that the Dashboard carries **a separate table
showing the progress of each editor for each language**, beside 23's stats and 25's
payout. This is the panel that absorbs what the `translator-status-report` map was
going to publish as a weekly Claude Artifact; tickets 04, 05, 06 and 07 of that map
were ruled out the same day in favour of this table.

Verified in the tree on 2026-09-01, so the build starts from fact:

- **`shares.role` is `viewer | editor` only** (`convex/schema.ts:359`, and the same
  union on `pendingShares` at `:378`). The `translator` third role that
  `translator-status-report` ticket 02 designed **is not built**. "Editor" in the
  operator's ask is therefore the role that already exists.
- **`shares.listEditionAccess`** already returns, per Edition, everyone granted
  access, accepted and pending, with their role. That is the row source for this
  table, and `UsersTab.tsx` already renders it one section per Edition.
- **A pending invite has no account**, and the roster marks it. So the table already
  has two rungs available for free without any new schema.

The decisions this ticket has to make:

1. **What "progress" means for an editor.** There is no edit log and no edit stamp
   anywhere: `translator-status-report` rejected `editedAt` / `editedBy` outright,
   which is precisely why its status ladder is derived rather than measured. The
   candidates, in ascending honesty and cost: the derived ladder (Rostered, Invited,
   Busy, Finished), a count of translated units, or a real edit stamp added now.
   Deriving costs nothing and lies a little; measuring costs a schema change.
2. **Whether the derived ladder still holds on this surface.** It was designed for a
   weekly report read by the tenant admin, not a live tab read by the course owner.
   `translator-status-report` ticket 08 exists precisely because "Finished" may lie:
   it derives from `publishedEditions.published` or a `listings` row, both **owner**
   acts, so on a course whose owner publishes eagerly every language reads Finished.
   That ticket is unresolved and this table is its first real consumer. Resolve 08
   first or decide here and say so loudly in the Answer.
3. **Whether a language with no editor gets a row.** The most useful cell on this
   table is probably the empty one. A table of only appointed editors cannot show it.
4. **Names, and the public repo.** `translator-status-report` keeps its roster out of
   the tree because this repo is public and the rows are real people with real email
   addresses. Nothing about that changes here: the table reads names from Convex at
   runtime and no fixture, screenshot or test may commit a real one.

Use `/tdd` and `/ponytail`; read `dataviz` before drawing any progress meter.

## Todo

- [x] Settle the four decisions above and record each in the Answer.
- [x] One owner-gated query returning one row per (editor, language), tested with
      `vitest` including the non-owner case.
- [x] Render as a real table in 23's Dashboard body, read-only, legible at 360px.
      A four-column table at phone width is the layout problem here.
- [x] Show languages with no editor, per decision 3.
- [x] Copy through the message namespaces, no hardcoded English.
- [x] No real name, email or roster row committed to the tree, fixtures included.
- [x] `pnpm typecheck` green.
- [ ] Walk it in a browser at phone width.

### Where it stands (2026-09-01)

Built and committed as `c748d08`. `pnpm typecheck` clean, 1001 tests pass.
**The browser walk has NOT happened**, same reason as ticket 23: nothing was
listening on port 3000 and the manage route needs a signed-in owner. No Answer
until it is walked, so this ticket stays claimed.

Worked out of frontier order at the operator's direction, while 23 still has no
Answer. 23's code was already built and committed, so nothing technical was
being waited on.

**The four decisions, as ruled by the operator on 2026-09-01.**

1. **What progress means.** The editor's OWN completion marks, the same
   `progress` rows (`status: "completed"`) the learner histogram counts. Not the
   derived ladder, not a count of translated units, and no new edit stamp. What
   it CANNOT see: who edited what. No write path records an editor, so an editor
   who reworks every lesson without marking any complete reads as zero. The
   measurement is "how far they have read through it", offered as the proxy for
   how far they have worked through it.
2. **Whether the derived ladder survives.** It does not, and it is gone. There is
   no Rostered/Invited/Busy/Finished rung on this surface at all; there are
   counts, plus one qualifier. See the ticket 08 note below.
3. **Languages with no editor.** They get a row, with "No editor appointed". The
   empty cell was the point.
4. **Names and the public repo.** The table reads `users.name` (falling back to
   `users.email`) from Convex at runtime. Nothing real is committed: the tests
   use `@example.com` and `@test.invalid` addresses only.

**Two departures from this ticket's Todo, both deliberate.**

- **No separate query.** The rows ride on 23's existing `courseStats`. The
  `progress` scan is the dashboard's dominant read and was already in hand, so a
  second owner-gated query would have doubled it for rows derived from the very
  same documents. Still one owner-gated query, tested with the non-owner case;
  it is just 23's.
- **Not a four-column table.** Grouped under language headings instead, which is
  how the ticket's own stated layout problem (four columns at 360px) goes away:
  the language becomes the heading rather than a column.

**A correction to this ticket's premise.** It says there is "no edit log and no
edit stamp anywhere". Half true as of 2026-09-01: `applyTranslatedLessonEdit`
(`convex/content/authoring.ts:399`) writes `htmlStorageId` and clears the inline
`html`, while machine translations are stored inline, so a human edit to an
Edition IS distinguishable from machine output. What genuinely does not exist is
attribution: no write path records WHO edited. That is why option 1 above is a
reading proxy rather than a measurement, and it is what a future
`editedBy`/`editedAt` ticket would fix.


## Done when

The Answer names what progress means and what it cannot see, states whether the
derived ladder survived contact with this surface (and what that means for
`translator-status-report` ticket 08), and records that the table was walked in a
browser at phone width rather than only read.
