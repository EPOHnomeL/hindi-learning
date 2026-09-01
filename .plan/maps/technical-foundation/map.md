# Technical foundation: scalability, refactoring and code architecture

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Every open decision about **how this codebase is built** lives in one place, with its
dependencies visible, so that a session picking up architecture work can see the whole
frontier without reading twelve feature maps.

Chartered 2026-09-01 by gathering the technical work that was scattered across twelve
feature maps, plus five items of real architecture debt that no ticket covered at all.

The destination is reached when this map's tickets are resolved, not when the codebase is
"clean". Scope is fixed by one test: **would this change be worth doing if no feature
needed it?** Read amplification, module boundaries, data-model gaps, decision-record drift
and deliberate-shortcut debt all pass. A feature that happens to need a migration does not.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is plan-don't-do,
  and this is the Notes override the convention requires. Refactors are not decisions with
  a build queued behind them; the decision is usually trivial and the work is the whole
  point. Tickets 01, 03, 06, 10, 12, 15, 16, 17, 18 and 20 are execution. The grillings
  (02, 04, 05, 07, 08, 09, 11, 13, 14, 19) are genuine open decisions.
- **Verify before reasoning.** Every size and count on this map was measured on 2026-09-01
  and is written with that date. Re-measure before acting: `lib.ts` grew from ~25 import
  sites to 32 while sitting un-ticketed.
- **`pnpm typecheck` is the cheap check** and needs no server. Never stop the dev server.
- Skills worth calling here: `ponytail` and `ponytail-review` (the laziest thing that
  works, usually the right size for a refactor), `codebase-design` (deep-module vocabulary,
  for the seam questions in 16 and 18), `convex-performance-audit` (for 01),
  `convex-migration-helper` (widen, migrate, narrow, for 01 and 06), `domain-modeling` (for
  07 and the ADR tickets), and `tdd` for anything touching the money rail.
- **Two tickets stayed behind on purpose**, the honest exceptions to this map's claim to
  hold all the technical work:
  - `course-publishing/11` (per-tenant `selling` flag) is migration-shaped and would have
    fitted, but `course-publishing/14` (Catalogue query) is `blocked_by` it, and 14 is
    feature work with no place here. Moving 11 would have orphaned that edge.
  - `ui-overhaul/03` (Design foundation: tokens, components, tenant theming) overlaps
    [03](tickets/03-shadcn-foundation.md) heavily and is arguably the same job, but it sits
    three deep behind buying Mobbin Pro in a map about UX evidence. **Whoever resolves 03
    here must reconcile the two**, or the second one to run will be wrong.
- `urdu-chrome-locale` kept only its message-catalogue ticket; its RTL spine is
  [09](tickets/09-chrome-rtl-strategy.md) and [10](tickets/10-rtl-app-shell.md) here.

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | Slim the translation row `listLessons` collects | `convex-cost/01` |
| 02 | Does the lesson body, and the quiz, come out of the iframe | `ui-overhaul/05` |
| 03 | Shadcn/ui foundation | `internal-course-studio/04` |
| 04 | The `/content` route is an open bearer URL | `marketplace/12` |
| 05 | Offline Lesson content, under a lease | `reader-experience/05` |
| 06 | Backfill anchor ids into existing References | `reader-experience/04` |
| 07 | Course co-authorship / ownership transfer | `course-management/03` |
| 08 | Review session management | `auth-sessions/02` |
| 09 | Decide the chrome RTL strategy | `urdu-chrome-locale/01` |
| 10 | Build: flip the app shell to RTL | `urdu-chrome-locale/03` |
| 11 | Off-peak scheduling for course generation | `course-authoring/05` |
| 12 | Cost instrumentation (tokens per Routine run) | `internal-course-studio/03` |
| 13 | Replace the committed USD to ZAR rate with a live one | `marketplace/05` |
| 14 | Supersede ADR 0016, the money model that shipped | `marketplace/09` |
| 15 | Record the ADR: Mux is the product-wide video rail | `media-generation/04` |
| 16 | Finish emptying `lib.ts` | new, was un-ticketed debt |
| 17 | Rename `lib.ts` to `edition.ts` | new, was un-ticketed debt |
| 18 | Split `convex/tenants.ts` | new, was un-ticketed debt |
| 19 | ADR 0014 is cited more narrowly than its scope | new, was un-ticketed debt |
| 20 | The 19 `ponytail:` markers have no ledger | new, was un-ticketed debt |

Tickets 16 to 20 were the **Follow-ups** section of the closed
[architecture-deepening](../architecture-deepening/map.md) map, plus one observation of this
session. That section is not a ticket file, so none of it was ever on any frontier: closing
that map made its own leftovers invisible. All five claims were re-verified in the tree on
2026-09-01 before being written up, and one had already gone stale (see 18).

## The dependency graph

Five edges, and each one exists because doing the work in the other order wastes it.

```
02 iframe/quiz architecture  ->  03 shadcn foundation
04 /content bearer URL       ->  05 offline under a lease
09 RTL strategy              ->  10 RTL app shell
12 cost instrumentation      ->  11 off-peak generation
16 empty lib.ts              ->  17 rename to edition.ts

frontier (15):  01 02 04 06 07 08 09 12 13 14 15 16 18 19 20
blocked   (5):  03 05 10 11 17
```

- **02 to 03**: 02 decides whether the quiz becomes React. If it does, the component set
  must include quiz primitives, and a foundation built first is a foundation that cannot
  reach the highest-traffic surface in the product.
- **04 to 05**: a lease buys revocation. `/content` currently gives permanent
  unauthenticated read access to every lesson body anyone has opened, so until 04 decides
  whether that is accepted, 05 cannot know whether its whole mechanism is worth anything.
  05 asks this question itself.
- **09 to 10**: strategy before the sweep. 10 is the physical-property debt fix across the
  learner surfaces, and its size depends entirely on what 09 decides about the flip.
- **12 to 11**: the buffer-of-one gate exists as a deliberate cost throttle. Removing it
  for overnight full-course generation cannot be priced without per-run token numbers,
  which is what 12 builds. **This edge is new**, added at charting.
- **16 to 17**: the rename was explicitly declined until the file is emptied, because
  `edition.ts` would misname a junk drawer more precisely than `lib` does.

## Decisions so far

<!-- one line per resolved ticket -->

_(none yet: chartered 2026-09-01.)_

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. The test is whether the question
     can be phrased precisely now, not whether it can be answered now. -->

- **`AdminPanel.tsx` is 2617 lines**, more than twice the next largest file in the repo
  (`ArtifactView.tsx`, 1149). Measured 2026-09-01. It is obviously too big and just as
  obviously not yet a ticket: nobody has established what it splits *into*, and the answer
  probably depends on [03](tickets/03-shadcn-foundation.md) settling the component
  vocabulary first. `clears-with: 03`
- **`convex/translate.ts` is 1212 lines**, the largest file in `convex/`, and it holds two
  `ponytail:` markers (Q&A translation dropped in the routine cut-over; a full scan of the
  lock table). Whether it wants the 16-and-18 treatment or something else is unclear until
  [20](tickets/20-ponytail-debt-ledger.md) says what its shortcuts actually cost.
  `clears-with: 20`
- **Six of the 30 ADRs are still `status: proposed`.** Two of the six are handled by name
  ([14](tickets/14-adr-superseding-0016-payfast-merchant-model.md),
  [19](tickets/19-adr-0014-citation-scope.md)). Whether the rest need a sweep, or whether
  "proposed" is simply how this repo writes a decision it has not built yet, is a question
  those two tickets will answer by example.
- **No architecture tests, and no boundary enforcement.** Nothing stops the next junk
  drawer forming, and 16 to 18 fix instances rather than the pattern. Too coarse to ticket
  until the splits are done and the real seams are known. `clears-with: 16`

## Out of scope

- **Feature work that merely needs a migration.** The scope test above is deliberate: a
  widen-migrate-narrow is not architecture work just because it touches the schema. This is
  why `course-publishing/11` stayed put.
- **Rewriting ADRs to correct them.** A stale ADR gets a superseding one; the original
  stands as the record of what was decided and when. Tickets 14 and 19 both operate under
  this constraint.
- **Performance work with no measurement behind it.**
  [01](tickets/01-slim-the-row-listlessons-collects.md) earns its place with a real billing
  number (1.16 GB of Database I/O in a month) and is honest that the saving is about
  $0.60/month. Anything without a number like that is not on this map.
- **The dev-tooling and observability signups** (`ui-overhaul/01` Mobbin, `ui-overhaul/07`
  PostHog) stay in `ui-overhaul`. They gate UX evidence, not code architecture.
