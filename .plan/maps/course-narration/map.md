# Course narration

<!-- Charted 2026-09-15, after the AI-voice pilot shipped. This map is an INDEX,
     not a store: each open decision lives in its own ticket and is gisted here. -->

## Destination

A locked set of decisions for **listening to a course** rather than reading it:
where the player lives and what it remembers, which lessons and which Editions get
narrated, who pays for a render and when it happens, and whether listening counts
as Progress.

## Notes

- **This map carries build tickets as well as decisions**, stated here because
  wayfinder's default is plan-don't-do. The pilot is already built and live; what
  is left is partly design and partly work.
- **The pilot is built, not merely decided** (2026-09-15). On `prophetic-school`,
  English: a circular play control inside the lesson under its heading
  (`NARRATE_BRIDGE` in `src/app/_components/lessonSrcDoc.ts`), an ElevenLabs render
  cached per lesson in `lessonAudio`, and a split where **anyone who may read a
  lesson may play a rendered narration, but only an administrator may commission
  one**. Rails: `convex/lessonAudio.ts`, `convex/narrationText.ts`. Operator CLIs:
  `pnpm narrate:prod` (precompute a course, dry run by default) and
  `pnpm voices:prod` (what the API key can actually drive).
- **Measured, not estimated** (2026-09-15): lesson 1 of `prophetic-school` is 7,214
  narration characters, about $0.72 on `eleven_multilingual_v2`. The 56-lesson
  course is roughly 498,000 characters, about $50, or half that on
  `eleven_flash_v2_5`.
- **The single-request cap is the live constraint.** `eleven_multilingual_v2` takes
  10,000 characters and the median lesson is near it (an estimated 8 of 56 English
  lessons exceed it; 33 of 56 in Spanish). `eleven_flash_v2_5` takes 40,000 and
  costs half, at a lower quality bar. Either chunk-and-stitch gets built or the
  model changes; `pnpm narrate:prod` reports exactly which lessons are affected.
- **Voice casting is done for now:** George (`JBFqnCBsd6RMkjVDRZzb`, "Warm,
  Captivating Storyteller"), chosen by the repo owner on 2026-09-15 after
  auditioning against Bella on this course's own lesson 1. It is the code default
  and `ELEVENLABS_VOICE_ID` overrides it.
- **An ElevenLabs API key carries its own credit quota**, separate from the plan,
  and a render refused by it returns 401, not 402. That cost a diagnosis on
  2026-09-15; see `docs/agents/project-context.md`.
- The deferred scoping note this pilot cut a slice out of is
  `../authoring/assets/deferred/course-audio.md`. It still holds the questions this
  map has not reached: Editions, and whether listening ticks Progress.
- **The player is built** (2026-09-18, commit `769c34d`): a bar docked to the foot
  of the lesson, appearing once playback starts. See ticket 01 for every call it
  locked and `assets/01-floating-player-prototype.html` for the four surfaces it
  was chosen from (open it in a browser, it needs no server).
- Skills: `/ponytail`, `/tdd`. `/prototype` before any further player UI: the
  four-variant lab in `assets/` is the shape that worked, and the HITL rule in
  CLAUDE.md means a written description of a player is not a player.

## Decisions so far

<!-- one line per resolved ticket -->

- [Scope the floating player](tickets/01-the-floating-player.md): a bar docked to
  the foot of the lesson, appearing once playback is asked for, carrying
  play/pause, the lesson title, elapsed over total and a progress hairline.
  In-lesson only (leaving still stops playback), resume for the length of one
  visit in memory rather than in Progress, text highlighting ruled out. Decided
  against a prototype the owner opened, and built the same day.

## Not yet specified

- **Does listening travel across lessons?**
  Ticket 01 kept the `<audio>` in `LessonView`, so navigating away stops it, and
  named this the map's biggest remaining question rather than a detail. A player
  that keeps reading while the learner moves through the course is a different
  component in the root layout with its own queue, and it needs a reason to exist
  before it gets one: nobody has asked to listen across lessons yet.
- **Editions.** Narration is English-only today and the cache is keyed by `lang`,
  so the shape is ready, but nobody has decided whether audio multiplies per
  language or whether that is a per-tenant opt-in. Cost at Edition scale is the
  reason to be careful: the 56-lesson course is about $50 per language.
- **Does listening count as Progress?** A learner who hears a lesson end to end has
  arguably completed it, and the reader currently only ticks on advance.

## Out of scope

- Generating media (the marketing trailer, the two-host podcast overview), which is
  [media-generation](../media-generation/map.md). This map is about narrating the
  course as authored.
