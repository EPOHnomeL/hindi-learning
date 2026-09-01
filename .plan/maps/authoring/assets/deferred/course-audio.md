<!-- NOT A TICKET. Deferred 2026-09-01 in the .plan consolidation: this was a ticket on a map
     that no longer exists, and its subject is now a fog patch under "## Not yet specified" on the
     authoring map. Kept verbatim (frontmatter stripped) so re-cutting it as a ticket costs nothing but a
     `git mv` back into tickets/ and a number. Nothing here is a commitment. -->


# Scope course audio (NotebookLM-style podcast for learners)

## Question

## Why

"Podcast and other media (notebook lm)" — resolved 2026-07-15 as **learner-facing study
media**: audio renderings of the course so its learners can study by listening (commute,
chores). NotebookLM's two-host audio overview is the reference experience.

## Questions to answer

- Format: two-host dialogue overview (engaging, needs script generation + two voices) vs.
  straight narration of lesson content (simpler, more faithful)? Per-lesson episodes vs. one
  whole-course overview — recommendation: per-lesson episodes, they map onto the existing
  Lesson/Progress model.
- TTS provider + cost per lesson/course (Hindi and multilingual voices matter here — same
  quality bar as the translate pipeline). Script generation: the Routine authors a narration
  script alongside the lesson, or derived after the fact from lesson HTML?
- Runtime placement: TTS APIs are plain HTTP — Convex-action compatible (unlike video
  rendering), so both provider lines could support it (rich-media/08 matrix). Confirm.
- Lifecycle: generated at publish (every lesson gets audio, cost scales with authoring) vs.
  on-demand first-play (lazy, cold-start delay)? Immutable like the lesson it renders?
- Editions: audio per language (multiplies cost by Editions) or source-language only in v1?
  Where does the player live in the reader; does listening count as [[Progress]]?
- Storage/serving: audio blobs in the Hub via the `/content` route — range requests for
  scrubbing (same verification as rich-media/06 needs).

## Out of scope

- The marketing trailer (ticket 01).
- Video renderings of lessons.

## Deliverable

Format + lifecycle decision, TTS provider/cost estimate, the Editions answer, and whether
listening ticks Progress.

## Done when

The format and lifecycle decision, a TTS provider/cost estimate, the Editions answer, and whether listening ticks Progress.

<!-- Migrated 2026-07-30 from GitHub issue #63 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `course-media` map (2026-08-01)

<!-- was .plan/maps/authoring/assets/deferred/course-audio.md; the course-media map was consolidated into media-generation -->

- **Pedagogy, inward, per-lesson, learner-consumed** — the opposite pull from the
  [course trailer](01-scope-course-trailer.md); do not collapse the two.
- TTS is plain HTTP and Convex-action-compatible (unlike video rendering) — the provider
  split is friendlier to this ticket than to the trailer.
- **Fog:** whether audio multiplies per Edition. The real answer depends on the funding
  decision in
  [Authoring-cost funding & model-provider strategy](../../../distribution/tickets/01-authoring-cost-and-model-provider-strategy.md).
