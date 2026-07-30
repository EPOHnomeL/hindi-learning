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

