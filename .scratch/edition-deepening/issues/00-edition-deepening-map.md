# edition-deepening/00: Edition surface deepening — map

**Status:** open
**Labels:** wayfinder:map

<!-- The canonical wayfinder map for deepening the Edition read surface. An INDEX,
     not a store: each decision/change lives in its own ticket; the map only gists
     it and links. Load this once per session, then zoom into tickets on demand.
     Charted 2026-07-20 from the architecture review (HTML report) +
     .scratch/edition-reader/README.md. -->

## Destination

The **Edition** read surface is three deep modules with content.ts / public.ts collapsed onto them:

1. **one Edition reader** (`lib.loadEdition`) — the "translated row else English source" projection lives once;
2. **one grant resolver** (`grantsFor`) — the `viewer`/`entitled`/`enrolled` fan-out resolved in one table-walk;
3. **one selection seam** (`resolveEdition` over a principal) — authed + Guest selection/classification decided once;
4. **content.ts / public.ts collapsed** into thin adapters over the shared reader core.

All **landed as tested code** — interface grilled per ticket (design-in-ticket), then TDD, old per-file tests deleted.
Reaching the destination means the fallback rule, the grant fan-out, and Edition selection each live in exactly one
place, and the two readers are adapters, not parallel re-implementations.

## Notes

- **Execution rides in the map** (overrides wayfinder's plan-don't-do default — user asked to *implement*). Each
  ticket = interface grill (design-in-ticket, per README's own next-step) → **TDD** to landed code → delete the old
  per-file tests it replaces. Produce merged code, not just a decision.
- **Domain:** the unit is the **Edition** (CONTEXT.md) = (Topic × language). The three grant primitives —
  **Share** / **Entitlement** / **Enrollment** — share a `(topicId, userId, lang)` shape but stay **distinct tables**
  (ADR-0023 keeps them separate for labelling: "Shared with me" / "Purchases" / "Joined"). Ticket 02 deepens the
  *read* over them, never the storage.
- **Source of this map:** the architecture review HTML report + `.scratch/edition-reader/README.md` (the deferred
  candidate, still current). The review confirmed `public.editionMap` is a byte-for-byte copy of `content.editionMap`,
  and that ADR-0023's `enrolled` primitive landed as a third copy of the `*Langs` pattern.
- **Deepen, don't rebuild — a partial seam already exists** in `convex/lib.ts`: `translatedTitle`, `pickContentBody`,
  `editionAccessLevel`, `heldLangs`, `readableLang`, `resolveReaderEdition`. Grill *against* these; adopt/extend them.
- **Vocabulary:** use the `/codebase-design` glossary exactly (module, interface, depth, seam, adapter, leverage,
  locality). Name new modules against CONTEXT.md's domain terms.
- **Skills to consult:** `/grilling` + `/domain-modeling` (interface shape), `/tdd` (test-first), `/ponytail` (laziest
  interface that works), `convex:convex-expert` (writing convex/ code) and `convex:convex-reviewer` (before shipping).
- **Coordination:** the user runs concurrent sessions on `main`. Stage explicitly **by path**, re-check
  `git diff --cached --stat`, never `git add -A`, never `--amend`. Separate conventional commits per logical change.
  Tickets 01 and 02 are both on the frontier and touch overlapping files (`lib.ts`, `content.ts`, `public.ts`) — if
  run in parallel, expect and resolve textual overlap in `lib.ts`.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then zoom the link -->

- [The Edition reader — `lib.loadEdition`](01-edition-reader.md) — the "translated row else source"
  projection now lives once: a `loadEdition(ctx, topic, lang)` reader (point-read accessors +
  memoised `map()`) replaces `trOne`/`editionMap`/`public.editionMap` and the hand-inlined title
  lookups across content/public/capture/shares/certificates. Read profiles preserved; shares titles
  now decoded (bug fix). Commits `be164c5`, `69f845f`.
- [The Edition grant resolver — `grantsFor`](02-edition-grant-resolver.md) — the `viewer`/`entitled`/
  `enrolled` fan-out now resolves in one table-walk: `grantsFor(ctx, topicId, userId) → Map<lang,
  Grant>` (provenance kept, precedence viewer > entitled > enrolled) replaces `viewerLangs`/
  `entitledLangs`/`enrolledLangs`. `heldLangs`/`editionAccessLevel`/`readableLang` take an optional
  precomputed map; `resolveReaderEdition` walks once per request and threads it. Owner stays a
  caller-resolved special case (source + ready translationJobs), not a grant. Adding a grant type is
  now one block + one union member. Commit `7a2c5a3`.

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

- **Collapse content.ts / public.ts into one reader + two adapters.** The destination's final leg (review candidate 04):
  make the authed reader and the Guest reader thin adapters over one shared reader core, deleting the parallel query
  stacks. Blocked in spirit by **the Edition reader** (the projection must be deep first) and **fold the
  Edition-selection resolvers** (selection/classification unified across authed + Guest). Its exact slicing — one
  ticket or several (reader core, authed adapter, Guest adapter, delete-old-queries, migrate tests) — hangs on how
  those two land, so it stays fog until they do. **The Edition reader (01) is now closed** — the
  reader core is deep, so the authed/Guest adapters have something to sit over; this now waits only
  on **fold the Edition-selection resolvers (03)**. Graduates once 03 is closed.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **Merging the grant tables.** `shares` / `entitlements` / `enrollments` stay **distinct tables** — ADR-0023 keeps
  them separate on purpose (row-label provenance for "Shared with me" / "Purchases" / "Joined"). This effort deepens
  the *read* over them (ticket 02), never the schema. Returns only if that ADR is redrawn — a fresh effort.
