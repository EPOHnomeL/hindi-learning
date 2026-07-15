# rich-media/07: Scope video-anchored teach mode (segmented, understanding-gated)

**Status:** open
**Depends on:** 03, 04

## Why

The product idea: a course built *on top of* a video + transcript, where each Lesson embeds
one video segment plus quizzes and supporting content, and the next segment is released as the
learner demonstrates understanding of the previous one. The gating machinery already exists —
the [[Frontier]] buffer-of-one plus quiz Responses in `CAPTURE.json` — so this is expected to
be teach-skill/AUTHORING.md **prompt policy, not schema**. Scope confirms that and writes the
policy.

## Questions to answer

- Curriculum planning: how does the teach skill turn a timed transcript (ticket 04's manifest)
  into a segment plan — transcript chapters, concept boundaries, target segment length? Where
  is the plan recorded (a learning record? NOTES.md?) so successive Routine runs stay
  consistent?
- Lesson shape: one segment per Lesson via the ticket-03 embed component (`start`/`end`),
  retrieval quizzes on *that segment*, citations pointing at timestamps. Draft the
  AUTHORING.md section.
- Remediation policy: "understands the previous concept" — is completing the Frontier enough,
  or do poor quiz Responses make the Routine author a remediation Lesson (re-using the same
  segment or a re-explanation) before advancing the video? Today's gate is completion-only;
  remediation is already possible as authoring policy — say when to use it.
- Mixed grounding: video + the Topic's other Resources (handbook PDF etc.) — how do they
  interleave?
- Interaction with `estimatedLessons` and [[Completion]]: course length is roughly bounded by
  video coverage — does the estimate come from the segment plan? Completion when the video is
  exhausted and outcomes met?

## Out of scope

- Any transcript/embed plumbing (tickets 03/04) — consume their outputs.
- New schema or gating tables (the null hypothesis is none are needed; scoping must prove it).

## Deliverable

A draft AUTHORING.md/SKILL.md section for video-anchored Topics plus the remediation policy,
validated against one real video end-to-end by hand (materialise → author two lessons →
check the gate story holds).
