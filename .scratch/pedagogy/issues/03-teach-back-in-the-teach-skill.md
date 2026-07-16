# pedagogy/03: Teach-back in the teach skill (close the pyramid's top)

**Status:** open
**Depends on:** — (seams with pedagogy/01, pedagogy/02, ai-chat)

## Why

Marking the teach skill against the learning pyramid (2026-07-15): it covers six of seven
levels — read (lessons, references, glossaries), listen/audio-visual (recommended sources,
assets), demonstration (simulators, guided real-world steps), discussion (follow-up
questions to the agent, communities), and apply (retrieval-practice quizzes, feedback
loops). The one missing band is the top: **the learner never teaches**. The agent does 100%
of the teaching; the user only receives, practices, and asks. The Wisdom section sends the
learner into communities but frames it as *testing skills*, not *teaching others*.

Honest evidence note (echoing pedagogy/01): the pyramid's percentages are folklore, but the
learner-as-teacher effect is independently real (the protégé effect, self-explanation
research) — so this is worth building on its own evidence, not because "90%".

This ticket is the **policy-side** fix from pedagogy/01's structural-vs-policy split: change
the skill's authoring rules only; no schema, no platform machinery. It gives "teach others"
the owner pedagogy/01 says is missing, without waiting on pedagogy/02's platform scoping.

## Proposed levers (cheapest first)

- **Teach-back segment** at the end of a lesson: the learner explains the concept in their
  own words; the agent plays confused student, probes, and captures the result in a
  learning record (existing machinery — learning records already exist for this).
- **Learner-authored references**: instead of the skill producing the glossary entry or
  reference doc for a just-taught concept, the lesson asks the learner to draft it and the
  agent reviews/polishes it into `./references/`.
- **Reframe the Wisdom/community posture**: alongside "test your skills", nudge "answer a
  beginner's question" once the learner is past novice on a concept.

## Questions to answer

- Where do the rules land in `SKILL.md` — a new `## Teach-Back` section, or folded into
  Skills (it's the strongest retrieval practice) and Reference Documents (learner-authored
  entries)? (`.agents/skills/teach/SKILL.md` is canonical; `.claude/skills/teach` symlinks
  into it — one edit, not two.)
- Cadence: every lesson, or once a concept exits the novice zone (ZPD-gated)?
- Evaluation: agent-as-confused-student works today in-session; does anything here need the
  ai-chat substrate, or is that only pedagogy/02's platform version? Keep this ticket to
  what works with zero new machinery.
- Does a captured teach-back belong in a learning record as-is, or does the
  LEARNING-RECORD-FORMAT need a small addition?

## Out of scope

- Platform-level teach-back state, completion gates, or assignment entities (pedagogy/02).
- The phase frame / step→component mapping (pedagogy/01).
- Cohort or community features.

## Deliverable

`SKILL.md` (and format docs if needed) updated so lessons routinely end in a teach-back
loop and learners author reference entries — the pyramid's top band owned by the skill.
