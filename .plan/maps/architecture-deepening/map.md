# Architecture review

<!-- The canonical wayfinder map for the 2026-07-24 architecture review. An INDEX,
     not a store: each candidate lives in its own ticket; the map only gists it
     and links. Load this once per session, then zoom into tickets on demand. -->

## Destination

Five deepening candidates surfaced by the `/improve-codebase-architecture` review
(report: `architecture-review-20260724-142432.html`, not checked in — regenerate via the skill
if needed). Scope was the four hottest areas since the edition-deepening effort closed: Edition
read/reader, payments/Ledger, whitelabel/tenant, translation engine selection.

Vocabulary: the `/codebase-design` glossary (module, interface, depth, seam, adapter, leverage,
locality). Domain terms: `CONTEXT.md`.

## Notes

- **Landed first (PR #107, `refactor/content-module-split`):** ticket 01, because it was the one
  candidate with a real seam at stake — the `PUBLISH_SECRET`-gated CLI write-back sharing a file
  with public reads.
- Tickets 02–05 are independent of each other and of 01 — any order is fine, no shared frontier.
- Ticket 02 (`lib.ts`) and ticket 01 both touch Edition-adjacent code but don't conflict: 01 moved
  `content.ts`'s call sites, 02 only reorganizes `lib.ts` itself.
- Skills to consult per ticket: `/grilling` + `/domain-modeling` (if a new module name needs a
  `CONTEXT.md` entry), `/tdd` (test-first for anything beyond a pure move), `/ponytail` (laziest
  interface that works), `convex:convex-expert` (writing convex/ code), `convex:convex-reviewer`
  (before shipping).
- **Coordination:** the user runs concurrent sessions on `main`. Stage explicitly **by path**,
  re-check `git diff --cached --stat`, never `git add -A`, never `--amend`.
- Delivery mode: ticket 01 shipped as a PR (#107) under an earlier one-off deviation from this
  repo's trunk-based convention. **The user reverted that for 02–05** (2026-07-28) — those landed as
  trunk commits on `main`, the repo's normal convention.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then zoom the link -->

- [Split content.ts into reader/authoring/publish modules](tickets/01-split-content-audiences.md) —
  **landed.** `convex/content.ts` (929 lines, three audiences under comment banners) split into
  `convex/content/reader.ts` / `authoring.ts` / `publish.ts`, every `api.content.*` /
  `internal.content.*` call site updated, tests split to match. Pure move, `tsc` clean, full
  convex suite green (458/459, one pre-existing unrelated flake). PR #107.
- [Give lib.ts's sections real module boundaries](tickets/02-lib-module-boundaries.md) — **landed**
  (`2adb6c2`). Tenant-flag gating, Seller readiness and progress counts split out of `convex/lib.ts`
  into `tenantFlags.ts` / `sellerStatus.ts` / `progressCounts.ts`; `lib.test.ts` (all tenant-flag
  tests) moved to `tenantFlags.test.ts`. Pure move. `lib.ts` keeps its name and its other residents —
  see Follow-ups.
- [Stop re-deriving paygate lock state on the client](tickets/03-paygate-lock-locality.md) — **landed**
  (`2610434`). `lessonsToc`/`referencesToc` take the caller's `EditionAccess` and carry a per-item
  `locked` from the same `lessonLocked` the body reads use, so `listLessons`/`listReferences`/
  `publicCourse` all ship the verdict. The References rule got the same treatment (`referenceLocked`).
  Removed the duplicate derivations in `CourseShell.tsx` **and** `PublicReader.tsx` (a third copy the
  spec hadn't listed). `ArtifactView.tsx` needed no change — its `role === "preview"` gates Q&A and
  Progress, not lock state.
- [Name the PayFast ITN acceptance rules as their own seam](tickets/04-payfast-acceptance-seam.md) —
  **landed** (`ddd0eae`). `payfast.acceptNotification(fields, intent)` is pure and returns a
  three-way verdict (`grant` / `ignore` / `refuse`) — three, not two, because "don't grant" means
  200-acknowledge for a CANCELLED notification and 400-reject for a tampered one. `payfastNotify` is
  now an adapter. Existing mocked-fetch ITN tests pass unmodified.
- [Disambiguate the three "engine"/"provider" axes](tickets/05-engine-vocab-disambiguation.md) — **landed**
  (`0f685b6`). `engine` (per-Edition) / `translationBackend()` (per-deployment) /
  `authoringProvider()` (per-course), each fallback stated once in its accessor. **No migration:**
  both persisted columns and `TRANSLATE_PROVIDER` keep their names — only the code vocabulary moved,
  which is what the "additive alias" question in the spec was really asking.

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

_(none — all five candidates from the review are already ticketed below.)_

## Open tickets

- _(none — all five landed.)_

## Follow-ups this batch surfaced

<!-- real, out of scope for the tickets that found them; each needs its own decision -->

- **Finish emptying `lib.ts`, then rename it.** Ticket 02 moved out the three concerns it scoped
  (`tenantFlags.ts`, `sellerStatus.ts`, `progressCounts.ts`), but `lib.ts` still hosts the topic
  resolvers, the content-blob helpers, `assertAdmin`, and the share/email/token/hash primitives. The
  `lib.ts` → `edition.ts` rename is **declined until then** — with those residents it would misname
  the file. ~25 import sites.
- **`tenants.ts`'s equivalent split** — noted in ticket 02's framing, still not ticketed, and Handoff
  A owns that file.
- **ADR-0014's citation is narrower than its scope.** `routine.ts` cites
  `docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md` (still "proposed") as the rationale
  for the shipped per-course authoring Provider field, but the ADR's real scope (BYOK line, Agent-SDK
  port, per-customer metering) is far larger than what's cited against it. Ticket 05 flagged this and
  left the ADR untouched — it needs the user's call: narrow the citation, or split the ADR.
  **Awaiting sign-off.**

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **The Edition read/grant/selection resolvers themselves** (`loadEdition`, `grantsFor`,
  `resolveEdition`) — the edition-deepening effort (closed 2026-07-22,
  `.scratch/edition-deepening/`) already deepened these; the review found no new friction there.
- **Whitelabel/tenant module structure** — reviewed and found clean (`src/lib/tenant.ts`,
  `src/app/_landing/registry.ts` are already proper seams). The one soft spot, `tenants.ts`
  accreting unrelated concerns, is folded into ticket 02's framing rather than ticketed separately
  — pick it up there if 02's pattern extends naturally, otherwise it's speculative on its own.
