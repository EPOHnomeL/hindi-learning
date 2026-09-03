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
- **The measured Convex billing baseline lives here now**, at
  [assets/convex-cost-baseline.md](assets/convex-cost-baseline.md). It was
  `.plan/maps/technical-foundation/assets/convex-cost-baseline.md` until the 2026-09-01 consolidation folded that
  ticket-less map in. [01](tickets/01-slim-the-row-listlessons-collects.md) reasons from
  it, and a measurement is the one thing a later session cannot re-derive from the code.
  Its live fog is in this map's `## Not yet specified` below.
- Skills worth calling here: `ponytail` and `ponytail-review` (the laziest thing that
  works, usually the right size for a refactor), `codebase-design` (deep-module vocabulary,
  for the seam questions in 16 and 18), `convex-performance-audit` (for 01),
  `convex-migration-helper` (widen, migrate, narrow, for 01 and 06), `domain-modeling` (for
  07 and the ADR tickets), and `tdd` for anything touching the money rail.
- **One ticket stays behind on purpose**, the honest exception to this map's claim to hold
  all the technical work: `ui-overhaul/03` (Design foundation: tokens, components, tenant
  theming) overlaps [03](tickets/03-shadcn-foundation.md) heavily and is arguably the same
  job, but it sits three deep behind buying Mobbin Pro in a map about UX evidence.
  **Whoever resolves 03 here must reconcile the two**, or the second one to run will be
  wrong.
- **Correction, 2026-09-01 (same day, later session).** This map originally listed a second
  ticket staying behind: `course-publishing/11` (per-tenant `selling` flag), on the grounds
  that `course-publishing/14` (Catalogue query) is `blocked_by` it and moving 11 would have
  orphaned that edge. Both halves of that reasoning were wrong on inspection. **14 is
  resolved and shipped** (2026-07-28, ADR 0024), so its `blocked_by` no longer gates
  anything, and `tenant-feature-modularity/10` (Build: the selling switch) **explicitly
  absorbs 11** and says so in its own body. `course-publishing/11` is therefore resolved as
  a scope transfer, not moved here: the flag is a tenant switch, and the switch map owns it.
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
| 21 | Forgot-password flow (email OTP reset) | `auth-sessions/01` |

Ticket 21 arrived later the same day, in the consolidation that took `.plan` from 33 map
directories to 7 active maps. It joins [08](tickets/08-review-session-management.md), which
came out of `auth-sessions/02`: account recovery is a session question, and that map held
only those two tickets, so its directory is gone.

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

frontier (16):  01 02 04 06 07 08 09 12 13 14 15 16 18 19 20 21
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

- [Chrome RTL strategy](tickets/09-chrome-rtl-strategy.md) 2026-09-03: the operator chose
  the **full flip** over shipping Urdu LTR first. `dir` comes from `langDir()` in the
  existing content-language registry rather than a second constant; the 73 physical
  utilities are one session, not a campaign; there is no icon-mirroring rule because
  there are no directional icons, only arrows living inside `en.json` strings; the chrome
  face is **Noto Naskh Arabic**, not Nastaliq, whose line-height would clip every
  fixed-height control; and acceptance splits layout (checkable by an English speaker)
  from translation quality (not claimed). Two findings shrank the job: the mobile sidebar
  is a bottom sheet on `translate-y`, so there is no drawer slide to mirror, and the
  lesson iframe is a separate document, so chrome `dir` cannot leak into an Edition.
- [Flip the app shell to RTL](tickets/10-rtl-app-shell.md) 2026-09-03: built in `7b3205b`.
  Verified in a browser on the public surfaces (landing and legal prose flip, fonts swap,
  LTR unchanged) and by unit test on the `langDir` seam. The authed surfaces and the
  chrome/lesson cross-pairs are **read-only verification**: the dev deployment has no
  `publicLinks` rows, so no Guest reader is reachable locally. See that ticket for the
  dev-versus-prod CLI trap that makes this look like a share-locale bug when it is not.

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
- **Where the unattributed Database I/O actually is.** The 2026-08-07 invoice billed 9 GB;
  the by-function breakdown accounts for 3.62 GB of it, filtered to prod. About **5.4 GB has
  no named cause**, which is larger than all three hot functions combined, and there are 9
  deployments on the account. Carried forward from the folded
  [convex-cost baseline](assets/convex-cost-baseline.md). Drill Database I/O per deployment
  before spending a session on [01](tickets/01-slim-the-row-listlessons-collects.md), or
  this map optimises the smaller half.
- **Whether moving deployments to a US region beats every optimisation on this map.** All
  deployments are EU-hosted, and EU usage cannot draw on the plan's included allowances, so
  every unit prices from the first one plus a 30% regional surcharge. US usage would draw on
  them: at this traffic that is a $0 bill, versus the cents 01 is worth. It is a
  configuration change, not a code change. Not free, since it moves data residency, which is
  a question about the courses' learners rather than about cost. Deliberately floating with
  no anchor: no ticket here sharpens it.
- **Whether the residual read scales with Editions or with readers.** The hot read is per
  (Topic, language), so each new Edition multiplies it, and
  [translation-and-locales](../translation-and-locales/map.md) is actively adding Editions.
  Which term dominates is unclear until more than one non-English Edition sees real traffic.
  `clears-with: 01`
- **No architecture tests, and no boundary enforcement.** Nothing stops the next junk
  drawer forming, and 16 to 18 fix instances rather than the pattern. Too coarse to ticket
  until the splits are done and the real seams are known. `clears-with: 16`

## Out of scope

- **Feature work that merely needs a migration.** The scope test above is deliberate: a
  widen-migrate-narrow is not architecture work just because it touches the schema. This is
  why the per-tenant `selling` flag is not here; see the 2026-09-01 correction in Notes for
  where it went and why the original reason given was wrong.
- **Rewriting ADRs to correct them.** A stale ADR gets a superseding one; the original
  stands as the record of what was decided and when. Tickets 14 and 19 both operate under
  this constraint.
- **Performance work with no measurement behind it.**
  [01](tickets/01-slim-the-row-listlessons-collects.md) earns its place with a real billing
  number (1.16 GB of Database I/O in a month) and is honest that the saving is about
  $0.60/month. Anything without a number like that is not on this map.
- **The dev-tooling and observability signups** (`ui-overhaul/01` Mobbin, `ui-overhaul/07`
  PostHog) stay in `ui-overhaul`. They gate UX evidence, not code architecture.
- **Adding more sign-in providers.** Google shipped, with account linking by email.
  [21](tickets/21-forgot-password-flow.md) is recovery for the password path, not a new
  provider. Carried over from the closed `auth-sessions` map.
- **Undoing per-tenant session isolation**, which is a decided position. Carried over from
  `auth-sessions`, and it bounds [08](tickets/08-review-session-management.md): that ticket
  reviews session lifetime and repeat sign-in friction, not the isolation itself.
