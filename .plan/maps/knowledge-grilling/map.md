# Knowledge grilling

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on bringing the `grill-my-knowledge` diagnostic interview into the app as a
learner-facing mode, with a **"teach me that"** handoff that feeds its gap map straight into
the teaching loop.

## Notes

- **What is new here is deliberateness.** Today the loop learns what a learner does not know
  only *indirectly* — from Responses to quiz prompts a Lesson happened to include, or a
  Question they thought to ask. There is no act of *finding the edge* before teaching.
- **The behaviour is already proven in a terminal:** one question at a time, adaptive
  follow-ups, **all answers and corrections withheld until the end** (grading mid-session
  contaminates the diagnosis), each branch graded solid / shaky / missing, emitting an ordered
  teaching agenda. Port that contract; do not redesign it.
- **The withholding rule is the fragile part.** A chat UI naturally wants to be helpful
  turn-by-turn, which would destroy the diagnosis. Whatever substrate serves this must be able
  to stay silent.
- **Shares a substrate with**
  [ai-chat/01](../ai-chat/tickets/01-interactive-ai-chat-substrate.md) — both need an
  always-on responder, and that map owns the serving-path and metering decision. Settle the
  seam early rather than building a second chat path.
- Skills: `/grilling` (fittingly), `/domain-modeling` for the gap-map term.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **What a gap map *is* in the data model** — a capture kind, a first-class entity, or a
  transient handed to the Routine. Sharpens once the substrate is fixed.

## Out of scope

- Replacing quizzes or Responses as the ambient progress signal — this is an additional,
  deliberate diagnostic, not a substitute.
