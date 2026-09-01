---
type: task
blocked_by: []
---

# Fix the four known stale facts

## Question

Scoping this feature was derailed by stale context: `project-context.md` said
selling was paused pending FICA when PayFast is live with 5 real purchases, and
two issues being reasoned about turned out to be already built. Roughly a third
of the session's early effort went into a world that no longer exists. These four
are known; fixing them is cheap and stops the next session repeating the waste.

Scope:

- **`docs/agents/project-context.md:158-166`** — the PayFast status block. Replace
  the "pending FICA verification / selling should be paused (`PAYFAST_MODE=off`)"
  claim with the live state: the merchant is verified, the rail is live, and real
  purchases have completed. Give it an absolute date, per the file's convention.
- **Close #52** — `sales.report` exists (`convex/sales.ts:17`).
- **Close #53** — Sales and Payouts tabs exist
  (`src/app/_components/AdminPanel.tsx:61`).
- **Close #113** — the first-open welcome panel shipped as a modal (`da02161`).
- **#46 "Improve Onboarding Flow"** — a one-line stub with no scope. Either give
  it real scope or close it. A stub issue is worse than no issue: it looks like
  tracked work and carries none.

Comment the evidence when closing, so a future reader can tell a deliberate
closure from an abandoned one.

Out of scope: the **systematic** sweep of docs and tracker against git history,
handed off separately (`.scratch/docs-reconciliation/HANDOFF.md`). These four are
the sample that motivated it, not the list. No ADR edited — a stale ADR gets a
superseding ADR, never a rewrite. Confirm the PayFast facts with the operator
before writing them down rather than inferring from this ticket.

## Done when

`project-context.md` reflects the live payments reality; the three built issues
(#52, #53, #113) are closed with evidence; #46 is scoped or closed; and no ADR is
edited.

## Answer

**Four out of five items were already fixed before this session opened — the
ticket had itself gone stale, which is exactly the failure mode it exists to
name.** Verified each rather than assumed; two needed real work, and it was not
where this ticket said it would be.

### Item by item

- **`project-context.md` PayFast block — already fixed, one day *before* this
  ticket was written.** `8c7d29c` (2026-07-29) replaced the pending-FICA /
  `PAYFAST_MODE=off` claim with the live status: FICA cleared, 5 real purchases,
  "treat the rail as production infrastructure", and the dev deployment's
  `sandbox` mode. It carries the absolute date the file's convention wants. The
  ticket was transcribed from `spec.md` on **2026-07-30** (`654b899`) and
  inherited a scope item that no longer existed. No operator confirmation was
  needed in the end — the facts were already written by someone who had them, and
  the map's own Destination and its 2026-08-01 operator note say the same thing.
- **#52 — already closed** on GitHub, 2026-07-30T13:05:12Z
  ([#52](https://github.com/EPOHnomeL/hindi-learning/issues/52),
  *admin-sales/01: Sales report query*).
- **#53 — already closed**, 2026-07-30T13:05:17Z
  ([#53](https://github.com/EPOHnomeL/hindi-learning/issues/53),
  *admin-sales/02: Sales tab + Payouts as its own tab*).
- **#113 — gone from GitHub, and the staleness had moved house.** It was one of
  the 48 open issues migrated into maps and deleted on 2026-07-30, landing as
  [First-open welcome panel in the reader](../../onboarding/tickets/02-first-open-welcome-panel.md)
  — where it sat **open** on a panel that shipped 2026-07-28. **Resolved there
  with the evidence** (`Welcome.tsx`, `welcomeDerive.ts`, both reader shells,
  `mission` on the `publicCourse` allowlist), including its two deliberate
  deviations from spec and its later purchase variant.
- **#46 — same story: migrated, deleted, still a stub.** Now
  [Improve Onboarding Flow](../../learning-experience/tickets/05-improve-onboarding-flow.md).
  **Scoped, not closed** — its map's Destination hangs off it. The one sentence
  ("This should be as smooth as possible") became a concrete walk: cold sign-up on
  prod, on a tenant subdomain, on a phone; what to record per stall; what to read
  first so the two already-diagnosed leaks aren't re-diagnosed; and what belongs
  to the three adjacent maps.

No ADR was edited.

### One extra fix, in this ticket's own file

`project-context.md:170` still pointed the reader at `.scratch/ywampotch-launch/PRD.md`
for the funnel diagnosis. The file exists and is tracked, but it is the superseded
PRD — the live record is `.plan/maps/ywampotch-launch/spec.md`. Repointed, with the
old path named as superseded rather than deleted.

### Carried forward

- **The retirement of GitHub issues silently re-homed this ticket's own scope.**
  Closing "#113" was never possible — the issue was deleted. Any surviving `#NN`
  reference in `.plan/` is a pointer into a tracker that no longer holds open work;
  resolve it through the migration note at the foot of the migrated ticket
  (`<!-- Migrated 2026-07-30 from GitHub issue #NN -->`), which is greppable.
- **This ticket's own out-of-scope pointer is broken for everyone but this
  machine.** `.scratch/docs-reconciliation/HANDOFF.md` exists on disk but is **not
  git-tracked** (only its `FINDINGS.md` sibling is), so the systematic sweep this
  ticket hands off to is invisible to a fresh clone. Not fixed here — the sweep
  owns its own relocation — but a session that goes looking for it and finds
  nothing should know why.
- **`.scratch/` link rot is broad and deliberately untouched.** ~20 references
  across `docs/adr/` and `docs/`. The ADRs are off-limits by this ticket's own
  rule (a stale ADR gets a superseding ADR, never a rewrite), and the rest is the
  systematic sweep's job, not this sample's.

