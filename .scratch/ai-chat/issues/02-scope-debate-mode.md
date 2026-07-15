# ai-chat/02: Scope Debate mode (AI debates & discusses the content)

**Status:** open
**Depends on:** ai-chat/01

## Why

"AI able to debate and discuss the content" — free sparring: the AI takes a stance on a
lesson's claims and the learner argues, defends, or attacks. Pedagogically this is effortful
elaboration (the teach skill's desirable-difficulty principle applied to dialogue). Distinct
from ticket 03 (resolved 2026-07-15): debate is **unstructured sparring**; 03 is a **guided
format**.

## Questions to answer

- Entry point: a "debate this" affordance on a lesson (anchored, with the lesson in context)
  vs. a command inside Course Chat? Recommendation to test: lesson-anchored, runs in the same
  thread infrastructure.
- Stance policy: does the AI steelman positions it "knows" are wrong (classic debate
  practice) — and how do we stop a learner walking away believing the steelman? (Explicit
  debrief turn at the end? Grounding rules from 01 apply — citations required?)
- Scope of debatable content: factual courses (Hindi grammar) offer little to debate —
  is debate offered only where the material supports it (who decides: the Routine flags
  debatable lessons at authoring?)?
- Does a debate leave a trace — a learning record / capture entry the Routine reads for ZPD,
  or ephemeral?
- Win/lose/score, or purely conversational? (Recommendation: no scoring in v1.)

## Out of scope

- The chat substrate (01), the guided format (03).

## Deliverable

Entry-point + stance-policy decision, the debatable-content rule, and what (if anything) a
debate writes back to the Hub.
