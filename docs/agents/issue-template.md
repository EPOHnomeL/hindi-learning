<!--
Template for a chartr ticket. Copy this into
.plan/maps/<effort>/tickets/<NN>-<dash-case-title>.md and fill it in — see
docs/agents/issue-tracker.md for the contract this encodes.

Two rules that are easy to break and matter most:

  * NEVER add a `status:` field, here or in the frontmatter. Status is DERIVED —
    prose under `## Answer` means resolved, prose under `## Ruled out` means out
    of scope, a `claimed_by` with neither means claimed, anything else is open.
  * `NN` is a permanent identity. Never reuse it, never renumber. A gap in the
    numbering is information (merged or resolved tickets), not untidiness.

`## Answer` is not written when the ticket is created — writing it is what
resolves the ticket. Delete the placeholder below until then.

Relative links resolve from `.plan/maps/<effort>/tickets/`, so the repo root is
four levels up (`../../../../CONTEXT.md`) and a sibling map is two
(`../../<other-effort>/map.md`).
-->

---
type: task # task | grilling | research | prototype
blocked_by: [] # ticket numbers in THIS map whose ## Answer this builds on
---

# <short imperative title>

## Question

<What this ticket asks, workable cold by a session that has read nothing else.
State the gap and why it matters; link the code that shows it
(`[file.ts:42](../../../../file.ts#L42)`). Name what is deliberately out of
scope and which ticket picks it up instead. If prior work already covers part
of it, say so here rather than letting the next session rediscover it.>

## Done when

<The concrete condition, observable rather than a list of steps — what is true
about the repo, the docs, or the decision record when this ticket is finished.
For a grilling/research ticket that is a decision written down, not code.>

## Answer

<Written on resolution: what was decided or built, and anything a later session
depends on — chosen direction, commit, resulting facts, follow-ups handed off.
The map's Decisions-so-far then gets one line gisting this and linking here.>
