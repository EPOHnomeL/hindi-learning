<!-- chartr-tracker-adapter: v1 — chartr wrote this file; it is safe to edit, and chartr will ask before replacing it. -->

# Issue tracker: chartr (local markdown)

This repo's wayfinder tracker is **chartr**: plain markdown under `.plan/maps/`,
committed to git, watched live. **No remote tracker, no `.scratch/`.** Every
wayfinder skill reads and writes maps by this file — the format below is the
contract; don't invent shapes or fall back to any `.scratch/` default.

chartr is also what **drives and visualises** the maps: the frontier, the blocking
graph and progress are computed from these files live (see "Status is derived"
below). That is the whole reason nothing here stores state — a written status is a
lie waiting to happen, and a derived one cannot drift.

## GitHub issues are retired (2026-07-30)

There is **one** home for tickets, and it is this one. Do not open, read, update or
reference GitHub issues for work tracking; do not run `gh issue`. The brief
two-homes split of 2026-07-29 (implementation local, planning on GitHub) is
reverted — it lasted a day and split the frontier across two systems that could
not see each other.

What happened to the old tracker, so nobody goes looking:

- The **48 open issues** were migrated into maps here — bodies verbatim, ticket
  numbers preserved from the efforts they were originally filed under — and then
  **deleted** from GitHub. Each migrated ticket ends in an HTML comment naming its
  original issue number and filing date.
- The **27 closed issues stay closed on GitHub**, untouched. They are finished work
  whose real record is the commits; deleting them would have destroyed history for
  nothing. Closed-issue references in a ticket's prose (e.g. "closed on GitHub as
  `google-signin/01`") still resolve there.
- Links into `.scratch/` PRDs and already-resolved sibling tickets were **de-linked**
  during the migration where the target no longer exists; the names are kept as
  prose for provenance.

GitHub is still the place for **code**: pull requests, releases, CI. Just not tickets.

## Layout

```
.plan/maps/<slug>/          # planning map + its spec.md (siblings)
  map.md                    # H1 title; ## Destination, Notes, Decisions so far,
  tickets/NN-slug.md        #   Not yet specified, Out of scope
  assets/
.plan/maps/<slug>-impl/     # implementation map, same shape
```

Implementation maps go under `<slug>-impl/`. `NN` is a ticket's permanent
identity — never reused or renumbered. (`.plan/handoffs/`, `.plan/research/` are
not maps.)

## A ticket — `tickets/NN-slug.md`

```markdown
---
type: task            # task | grilling | research | prototype
blocked_by: [01, 02]  # ticket numbers whose ## Answer this builds on
claimed_by: <session> # set while worked; chartr writes/clears it (by hand only offline)
---
# Title
## Question   — what it asks, workable cold
## Done when  — the concrete condition
## Answer     — what was decided/built (writing it resolves the ticket)
```

## Status is derived, never stored — no `status:` field

- `## Answer` with prose → **resolved** · `## Ruled out` with prose → **out_of_scope**
- `claimed_by` and no closing section → **claimed** · else → **open**

**Frontier** = open tickets whose `blocked_by` are all resolved — the work that can
start now. Computed, never written. A blocker clears the instant its `## Answer`
lands.

## Rules

1. Write only under `.plan/maps/` — never `.scratch/`, remote, or `docs/`; maps
   elsewhere are invisible to chartr.
2. Never store status; the agent writes prose, the tooling derives.
3. The map is the memory — anything the next session needs lives in an `## Answer`
   or the map's Notes.

## Before committing

Every `blocked_by` names a real ticket; each number used once; no stated progress
counts (they're derived). chartr checks these live when it's driving.
