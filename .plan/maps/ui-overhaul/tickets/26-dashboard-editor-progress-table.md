---
type: task
blocked_by: [23]
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
- [x] Walk it in a browser at phone width.

## Done when

The Answer names what progress means and what it cannot see, states whether the
derived ladder survived contact with this surface (and what that means for
`translator-status-report` ticket 08), and records that the table was walked in a
browser at phone width rather than only read.

## Answer

Built, walked and accepted. The foot of the course Dashboard carries editor
progress, grouped under language headings, read-only, with every language shown
whether or not it has an editor.

Shipped in `c748d08` (2026-09-01). `pnpm typecheck` clean, 1001 tests passing at
the time of the build.

Worked out of frontier order at the operator's direction, while 23 still had no
Answer. Nothing technical was being waited on: 23's code was already built and
committed, and only its browser walk was outstanding.

### Evidence: walked in a browser at phone width

The operator opened the Dashboard in a browser at phone width and accepted both
this table and 23's panels on 2026-09-03. A real walk, not a code read. The build
session could not reach one (nothing listening on port 3000, and the manage route
needs a signed-in owner), which is why this ticket sat claimed and answerless for
two days.

### What progress means here, and what it cannot see

An editor's progress is **their own completion marks**: the same `progress` rows
with `status: "completed"` that the learner histogram counts. Not the derived
ladder, not a count of translated units, and no new edit stamp.

What it **cannot** see is who edited what. No write path records an editor, so an
editor who reworks every lesson without marking any complete reads as zero. The
measurement is honestly "how far they have read through it", offered as a proxy
for how far they have worked through it. A future `editedBy` / `editedAt` ticket
is what would replace the proxy with a measurement.

**A correction to this ticket's own premise.** The Question says there is "no edit
log and no edit stamp anywhere". That was half true on 2026-09-01:
`applyTranslatedLessonEdit` (`convex/content/authoring.ts:399`) writes
`htmlStorageId` and clears the inline `html`, while machine translations are
stored inline, so a human edit to an Edition IS distinguishable from machine
output. What genuinely does not exist is **attribution**.

### The derived ladder did not survive its first consumer

There is no Rostered / Invited / Busy / Finished rung on this surface at all.
There are counts, plus one qualifier.

For `translator-status-report`: its ladder remains the settled model for anything
that still wants one, but **nothing built uses it today**. Its "does Finished
lie?" question was answered rather than dodged, and the ruling shipped in the same
commit: published-or-priced are both **owner** acts, so a live Edition on which no
editor holds a completion mark renders **Unreviewed** rather than Finished. That
question now lives at
[translation-and-locales 04](../../translation-and-locales/tickets/04-does-finished-lie.md)
after the consolidation, not at this map's old ticket 08.

### Languages with no editor get a row

They render with "No editor appointed". The empty cell was the point of the table:
a table of only appointed editors cannot show the gap an owner most needs to see.

### Names, and the public repo

The table reads `users.name` from Convex at runtime, falling back to `users.email`.
Nothing real is committed: the tests use `@example.com` and `@test.invalid`
addresses only.

### Two deliberate departures from the Todo

- **No separate query.** The rows ride on 23's existing `courseStats` as the
  `editorRows` field (`convex/dashboard.ts:81`). The `progress` scan is the
  dashboard's dominant read and was already in hand, so a second owner-gated query
  would have doubled it for rows derived from the very same documents. Still one
  owner-gated query, still tested with the non-owner case; it is just 23's.
- **Not a four-column table.** Grouped under language headings instead, which is
  how this ticket's own stated layout problem (four columns at 360px) goes away:
  the language becomes the heading rather than a column.
