<!--
Template for a local issue file. Copy this into
.scratch/<feature-slug>/issues/<NN>-<dash-case-title>.md and fill it in — see
docs/agents/issue-tracker.md for the full conventions this encodes.

Delete any section below that doesn't apply (e.g. "Tests" on a non-code
ticket). Keep section names and order for the ones you do use, so every
issue in the repo reads the same way.
-->

# <feature-slug>/<NN>: <short imperative title>

**Status:** open
**Depends on:** — <!-- or a list of other issue files/tickets this is blocked by -->
**Labels:** <!-- optional: a triage role from docs/agents/triage-labels.md -->

## Why

The problem or gap, in 1–2 short paragraphs. Link the code/doc that shows the
gap (`[file.ts:42](../../../file.ts#L42)`), state why it matters, and note
anything it unblocks.

## Scope

- Concrete, buildable items — name the exact files/functions/mutations
  involved.

## Out of scope

- What this issue deliberately does not cover, and (if relevant) which other
  issue picks it up.

## Acceptance criteria

- [ ] Testable, observable behaviors — not implementation steps.

## Tests (TDD, `convexTest` seam)

1. Numbered test scenarios, one per acceptance criterion where practical.

## Notes

Anything else worth carrying forward: ordering constraints, risks, decisions
made along the way.

## Comments

<!-- Append-only log. Never edit or delete a prior entry — add a new one. -->

### <name> — <YYYY-MM-DD>

Comment text.
