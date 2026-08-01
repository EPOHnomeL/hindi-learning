---
type: grilling
blocked_by: []
---

# Knowledge grilling: diagnostic mode + "teach me that" handoff

## Question

Deferred feature idea — not yet grilled or PRD'd. This ticket is the working copy; the
pre-migration path it used to point at no longer exists.

## The idea

Bring the `grill-my-knowledge` Claude Code skill's diagnostic-interview
behavior into the app as a first-class learner-facing mode, with a
**"teach me that"** handoff into the existing `teach` authoring loop.

Today the loop only learns what a learner *doesn't* know **indirectly** — by
watching Responses to quiz prompts a Lesson happened to include, or a
Question they thought to ask. There's no deliberate act of *finding the edge*
of someone's understanding before teaching them.

`grill-my-knowledge` already does this in a Claude Code terminal: it
interviews the learner one question at a time, **withholds all answers and
corrections** until the end (grading mid-session contaminates the
diagnosis), follows each thread until answers slide from recall into
guessing, grades every branch **solid / shaky / missing**, and emits a **gap
map** — an ordered teaching agenda handed straight to `teach`.

## Want

A learner-facing **grilling** mode on a Topic that:
- Interviews one question at a time, adapting each follow-up, pushing a
  branch until it finds the edge — never revealing answers mid-session.
- Grades each branch solid/shaky/missing and produces a gap map: shaky+missing
  items ordered by leverage, plus solid items flagged as demonstrated.
- Feeds the gap map back into the teaching loop so the Routine authors/
  reorders Lessons against diagnosed gaps, and skips re-teaching mastered
  material.

Two natural entry points to settle at triage: **placement** (grill early to
seed the first Lessons at the right level) and **checkpoint** (grill at a
Frontier or on Completion to confirm mastery).

## The central design question (must resolve before anything is built)

Grilling is inherently a live, adaptive, model-in-the-loop interview. The web
app deliberately has no LLM in the serving path (ADR-0001) — all teaching
intelligence lives in Claude Code / the Routine. These collide. Three
candidate resolutions, least→most architecturally disruptive:

1. **Routine-mediated, asynchronous** (preserves ADR-0001) — each learner
   answer captured like a Response, each next question authored like a
   Lesson. Cost: turns become hours apart, likely fatal to the UX that makes
   grilling work at all.
2. **Pre-authored branching grill** (hybrid) — the Routine authors a
   decision-tree artifact the browser walks with no live model; anything
   off-tree defers to the Routine. Cost: not truly adaptive, can only find
   edges it anticipated; grading free-text answers still wants a model.
3. **Live model in the app** (breaks ADR-0001 as written) — a model drives
   the grill in real time. The runtime is now provider-agnostic (ADR-0014),
   so this is no longer unthinkable the way it was at ADR-0001, but ADR-0001
   would need an explicit amendment and metering ties into the Managed/BYOK
   productisation lines.

Grilling may be the forcing function that revisits ADR-0001 — that's the
first thing to decide; everything else in scope depends on which path wins.

## Backend gaps (why this is a feature, not a tweak)

- No entity for a diagnostic session or a gap map — Responses answer *Lesson*
  prompts, not an adaptive interview with no Lesson.
- No way to tell the Routine "the learner already knows X, don't teach it" —
  only what they got wrong on a quiz.
- No inference path in the serving layer at all (ADR-0001) — paths 2/3 would
  introduce one.

## Notes for triage

- Owner-only — a Viewer writes nothing, a Guest has no server-side state.
- Faithfulness risk: the value is in *withholding* answers and pushing to the
  real edge. A watered-down "quiz that tells you the answer" is not this
  feature.
- Grading free-text solid/shaky/missing is a model judgement — pushes toward
  path 2/3, away from a purely dumb browser.
- Scope guard: this is diagnosis feeding the existing teach loop, not a
  second teaching engine.

## Next step

Run `/grilling` + a PRD pass under `.plan/maps/knowledge-grilling/` once picked
up — the design question above needs to be resolved first, before any
acceptance criteria get pinned down.

## Done when

The serving path, the gap-map capture, and the handoff into the teach loop are decided, with the ai-chat substrate seam settled, and a spec exists.

<!-- Migrated 2026-07-30 from GitHub issue #50 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `knowledge-grilling` map (2026-08-01)

<!-- was .plan/maps/pedagogy/tickets/05-diagnostic-mode-and-teach-me-that-handoff.md; that single-ticket map was consolidated into pedagogy -->

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
  [Interactive AI chat](04-interactive-ai-chat-substrate.md) — both need an always-on
  responder, and that ticket owns the serving-path and metering decision. Settle the seam
  early rather than building a second chat path.
- Skills: `/grilling` (fittingly), `/domain-modeling` for the gap-map term.
- **Fog:** what a gap map *is* in the data model — a capture kind, a first-class entity, or a
  transient handed to the Routine. Sharpens once the substrate is fixed.
- **Out of scope:** replacing quizzes or Responses as the ambient progress signal — this is an
  additional, deliberate diagnostic, not a substitute.
