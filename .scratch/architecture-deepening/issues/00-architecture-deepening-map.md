# architecture-deepening/00: Architecture review — map

**Status:** open (ticket 01 landed, 02–05 open)
**Labels:** wayfinder:map

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
- Delivery mode for this batch: **actual GitHub PRs** (branch + push + `gh pr create`) per ticket —
  a deliberate one-off deviation from this repo's normal trunk-based convention, confirmed with the
  user for the architecture-deepening work specifically.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then zoom the link -->

- [Split content.ts into reader/authoring/publish modules](01-split-content-audiences.md) —
  **landed.** `convex/content.ts` (929 lines, three audiences under comment banners) split into
  `convex/content/reader.ts` / `authoring.ts` / `publish.ts`, every `api.content.*` /
  `internal.content.*` call site updated, tests split to match. Pure move, `tsc` clean, full
  convex suite green (458/459, one pre-existing unrelated flake). PR #107.

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

- _(none — all five candidates from the review are already ticketed below.)_

## Open tickets

- [Give lib.ts's sections real module boundaries](02-lib-module-boundaries.md) — Strong.
- [Stop re-deriving paygate lock state on the client](03-paygate-lock-locality.md) — Worth exploring.
- [Name the PayFast ITN acceptance rules as their own seam](04-payfast-acceptance-seam.md) — Worth exploring.
- [Disambiguate the three "engine"/"provider" axes](05-engine-vocab-disambiguation.md) — Worth exploring.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **The Edition read/grant/selection resolvers themselves** (`loadEdition`, `grantsFor`,
  `resolveEdition`) — the edition-deepening effort (closed 2026-07-22,
  `.scratch/edition-deepening/`) already deepened these; the review found no new friction there.
- **Whitelabel/tenant module structure** — reviewed and found clean (`src/lib/tenant.ts`,
  `src/app/_landing/registry.ts` are already proper seams). The one soft spot, `tenants.ts`
  accreting unrelated concerns, is folded into ticket 02's framing rather than ticketed separately
  — pick it up there if 02's pattern extends naturally, otherwise it's speculative on its own.
