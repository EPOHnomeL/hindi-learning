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
  wayfinder's default is plan-don't-do. Tickets 02 and 03 are builds.
- **Narration is recorded off the server and uploaded** (2026-11-24, ticket 02,
  the owner's instruction). The operator renders a course on their own machine
  with **Kokoro** (Kokoro-82M, an open model, model id `kokoro-v1.0`) and uploads
  the mp3s. Nothing on the server calls a speech provider, so there is no key, no
  per-character bill and no request cap. This REPLACES the ElevenLabs pilot of
  2026-09-15, and everything that pilot's notes said about cost ($0.72 a lesson,
  about $50 a course), the 10,000-character request cap, chunk-and-stitch, the
  per-key credit quota and `pnpm voices:prod` is history, not guidance.
- **The operator's loop** is three steps, all resumable:
  `pnpm narrate:prod --topic <slug>` pulls each lesson's narration script into
  `.narration/<slug>/text/` (gitignored); a Kokoro front end renders
  `.narration/<slug>/audio/<voice>/<same name>.mp3`; `pnpm narrate:prod --topic
  <slug> --push` uploads what the deployment lacks. The header of
  `scripts/narrate.ts` has the render command. The Kokoro tool itself is outside
  this repo (on the owner's laptop at `C:\Code\tools\read-aloud`).
- **Voice casting, 2026-11-24:** two voices, chosen by the repo owner, and a
  learner picks between them: **Michael** (`am_michael`, American) and **Emma**
  (`bf_emma`, British). The list is `NARRATION_VOICES` in
  `convex/narrationVoices.ts` and its first entry is the default. He chose them
  from a sample of a novel, not of course text. George (ElevenLabs
  `JBFqnCBsd6RMkjVDRZzb`), cast 2026-09-15, is retired.
- **Measured 2026-11-24:** `prophetic-school` is 56 lessons and 524,690 narration
  characters (about 96,000 words) after `speakable`, so roughly ten hours of audio
  per voice. Kokoro on the owner's laptop (i7-1065G7, CPU only) makes about one
  minute of audio per minute when it has the machine to itself, and about a third
  of that while sharing it.
- **`speakable` exists because Kokoro reads characters literally**
  (`convex/narrationText.ts`). "John 16:13" came out as "sixteen thirteen", a
  middle dot or an arrow was dropped so two phrases ran together, and a slash was
  read as "slash". Every rule in it is for a pattern counted in `prophetic-school`,
  not a general normaliser: a second course will want its pulled text read through
  before it is rendered.
- **Who hears a recording:** anyone who may read the lesson (its owner, an admin of
  its tenant, or a holder of any grant), on any course that has one. The pilot's
  `prophetic-school`-only constant and its admin-only render permission went with
  the bill they guarded. A recording counts only if it is in a current voice,
  under the current model, and of the lesson body as it reads now; an edited
  lesson goes silent until it is rendered and pushed again.
- **Retired recordings stay in storage until purged.** `npx convex run
  lessonAudio:purgeRetired '{"apply":true}'` deletes every row and file that is no
  longer served (dry run without `apply`). It is irreversible and deletes audio
  that was paid for, so it runs only on the owner's explicit say-so.
- The deferred scoping note the pilot cut a slice out of is
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
  language or whether that is a per-tenant opt-in. Since 2026-11-24 the cost of a
  language is laptop hours, not dollars (about ten per voice for a 56-lesson
  course), but the harder question is new: Kokoro's voices are per language, and
  whether it has one worth listening to in Hindi, Urdu or Afrikaans is unknown.
- **Does listening count as Progress?** A learner who hears a lesson end to end has
  arguably completed it, and the reader currently only ticks on advance.
- **Other courses.** Only `prophetic-school` is recorded. The gate no longer names
  a course, so recording another is an operator decision (render, push), not a
  code change. Nobody has decided which courses get audio or who asks for it.

## Out of scope

- Generating media (the marketing trailer, the two-host podcast overview), which is
  [media-generation](../media-generation/map.md). This map is about narrating the
  course as authored.
