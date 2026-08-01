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
claimed_at: <RFC 3339> # ALWAYS set alongside claimed_by, same edit; cleared with it
---
# Title
## Question   — what it asks, workable cold
## Done when  — the concrete condition
## Answer     — what was decided/built (writing it resolves the ticket)
```

## Status is derived, never stored — no `status:` field

- `## Answer` with prose → **resolved** · `## Ruled out` with prose → **out_of_scope**
- `claimed_by` and no closing section → **claimed** · else → **open**

A claim is **always the pair** `claimed_by` + `claimed_at`, written in the same edit
and cleared together when the `## Answer` lands. `claimed_at` is not status — it's
how a reader tells a live claim from an abandoned one, since a session that dies
leaves `claimed_by` behind with nothing to say how stale it is. chartr flags a claim
older than **72h** as a probable dead session.

**`claimed_at` must be full RFC 3339** — date *and* time *and* offset:

```
claimed_at: 2026-08-01T14:02:00+02:00   # valid
claimed_at: 2026-08-01                  # MALFORMATION — no time, no offset
claimed_at: 2026-08-01 14:02            # MALFORMATION — space, no seconds/offset
```

A date alone or a space-separated time is a parse error chartr reports as a
malformation on the ticket, not a warning it works around. Get it from
`date -Iseconds`, never by hand.

**Frontier** = open tickets whose `blocked_by` are all resolved — the work that can
start now. Computed, never written. A blocker clears the instant its `## Answer`
lands.

## Rules

1. Write only under `.plan/maps/` — never `.scratch/`, remote, or `docs/`; maps
   elsewhere are invisible to chartr.
2. Never store status; the agent writes prose, the tooling derives.
3. The map is the memory — anything the next session needs lives in an `## Answer`
   or the map's Notes.

## Malformations chartr will flag (learned the hard way)

Every rule below was a real error chartr raised on a real map (2026-08-01, resolving
`marketplace/03`). They all come from the same root cause: **the map sections are
typed by ticket status, and writing a ticket into the wrong one is a lie the
derivation catches.** Check these before saving a map.

1. **`## Decisions so far` may only reference RESOLVED tickets.** It is the index of
   the route already walked — one line per ticket with an `## Answer`. Linking an
   *open* ticket from it (e.g. "…the build is 07 and 08") is a malformation, however
   useful the pointer feels. Put forward pointers in the resolved ticket's own body,
   or in the map's `## Notes` — never here.
2. **A fog patch's `clears-with: NN` must name an OPEN ticket.** The anchor is a
   promise that resolving NN will sharpen the patch. If NN is already resolved, the
   patch should have **graduated into a ticket** in that same edit. Resolving a
   ticket and leaving fog anchored to it is a contradiction.
3. **A patch with no plausible anchor simply has no `clears-with:`.** Don't invent an
   anchor to look tidy — genuinely-distant fog ("unclear until real money flows") is
   allowed to float.
4. **Decided ≠ built, and one ticket cannot say both.** chartr derives exactly one
   status per file, so a resolved decision ticket renders as Done — which reads as
   *shipped* unless the build is its own ticket. Split them: the decision ticket
   resolves, and a `Build …` ticket `blocked_by` it renders unstarted. That contrast
   *is* the "planned vs implemented" indicator; there is no separate status for it
   and chartr (an external binary) can't be extended to add one. Say so explicitly in
   the decision's Answer too — open its handoff with "decided, NOT built".
5. **A map that carries build tickets must say so in `## Notes`.** wayfinder's default
   is plan-don't-do, and it permits an override only in Notes. Unstated, an
   implementation ticket on a planning map is just off-destination.
6. **`claimed_at` is full RFC 3339 or it's a parse error** — see above. `date -Iseconds`.

## Before committing

Every `blocked_by` names a real ticket; each number used once; no stated progress
counts (they're derived); every rule in "Malformations" above holds. chartr checks
these live when it's driving — if it is open, read its banner before you commit
rather than after.
