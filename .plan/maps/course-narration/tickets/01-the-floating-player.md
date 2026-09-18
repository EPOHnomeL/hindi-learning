---
type: task
blocked_by: []
---
# Scope the floating player: where you are, and pause/play from anywhere

## Question

The narration control today is a circular play button sitting inside the lesson,
under its heading. It does one thing: start and stop. Once playback is running and
the reader scrolls, the control is gone off-screen, so there is **no way to pause
and no way to tell where you are** without scrolling back to the top.

So: what is the persistent surface that carries playback, and what does it need to
show? The request that prompted this (2026-09-15) was "a place where we can see
where we are and pause and play, like a floating button / island".

Decide, at minimum:

- **The surface.** A floating pill over the reader, a bar docked to the bottom, or
  something that only appears once playback starts. It has to coexist with what is
  already pinned in that space: the sticky lesson title bar, the mobile bottom nav
  (`AppTabs`), the end-of-lesson card, and the Teacher Q&A column on desktop. Those
  are the real constraint, not the visual design.
- **What "where we are" means.** Elapsed time, a scrub bar, a percentage, or the
  lesson's own text highlighting as it is spoken. Highlighting is a different order
  of work: it needs per-word or per-sentence timings, which ElevenLabs can return,
  but nothing in `lessonAudio` stores them and the cached mp3 carries none. Decide
  whether that is in or out before anyone builds it.
- **Whether it survives leaving the lesson.** Today the `<audio>` lives in
  `LessonView`, so navigating away stops it. A player that keeps reading while the
  learner moves through the course is a different component in a different place,
  and that is a real decision rather than a detail.
- **Resume.** Whether a learner returning to a lesson picks up where they stopped,
  and if so where that position is stored. The reader already has a `myProgress`
  rail; position-in-audio is not the same thing as Progress and probably should not
  be written into it without a reason.

## Done when

The surface, its contents, its scope (in-lesson or course-wide), and the
resume/highlighting in-or-out calls are all written down here, with enough
specificity that someone can build it without reopening any of them.

**A UI answer here needs a prototype the human has actually looked at before any of
it is written to `src/`**, per the HITL prototype rule in CLAUDE.md. A written
description of a player is not a player.

## Answer

**Decided AND built, 2026-09-18** (commit `769c34d`). Unusually for this map,
the decision and its implementation landed in one session, so this ticket is
genuinely shipped rather than merely resolved. What is left open is listed under
"Deliberately out" below, and none of it blocks anything.

Answered against a prototype the repo owner actually opened:
[assets/01-floating-player-prototype.html](../assets/01-floating-player-prototype.html),
four surfaces over a mock reader carrying the real chrome. Open it in a browser;
it needs no server. The verdict was **variant B, the docked bar**.

### The surface

A bar docked to the **foot of the lesson**, full width of the lesson column.

- **It appears only once playback has been asked for** (rendering, playing, or
  paused partway), not whenever a narration exists. This is the one change from
  the prototype as drawn, and it is the fix for B's only real weakness: drawn as
  always-present it stacked 58px of player on `AppTabs`'s 76px, about 18% of a
  phone screen spent on chrome for every learner who never presses play. To make
  it permanent, drop the `started` guard in `NarrationDock`.
- **The in-lesson circular control stays.** It is the invitation, beside the
  authored subtitle, and it is what is on screen before anyone scrolls. The dock
  is the persistent surface, not a replacement for the first press.
- **Mobile: `fixed`, riding the nav.** `AppTabs` tucks away on scroll in the
  reader (`useHideOnScroll`), so a bar pinned above it strands a gap. The dock
  reads the same signal and slides into the space the nav vacates, the mirror of
  the lesson title bar's `top-12`/`top-0`. `z-20`, below the lesson drawer
  (`z-40`) and its scrim (`z-30`), so opening the lesson list dims it with the
  rest of the page. A `md:hidden` spacer keeps the last line of the lesson and
  the inline Q&A clear of it, the same trick `AppTabs` already uses.
- **Desktop: `sticky bottom-0` inside the lesson column**, because that column
  is its own scroller. A fixed full-width bar ran under the sidebar and the
  Teacher Q&A aside and stopped reading as part of the lesson.

### What "where we are" means

**Elapsed over total, plus a 3px progress hairline along the top edge of the
bar.** Both are display only.

**Text highlighting is OUT.** ElevenLabs can return per-character timings, but
nothing in `lessonAudio` stores them and every already-cached mp3 carries none,
so turning it on is a schema change plus a re-render of the whole course, at the
cost recorded in the map's Notes. Seen in the prototype (the "Sentence
highlighting" toggle) it also reads as busy against a lesson somebody is reading
rather than following along with. Revisit only if a learner asks for it.

**No scrubber, no skip, no speed.** The request was to see where you are and
pause from anywhere; the track is a display, not an input. Marked `ponytail:` in
the code so `/ponytail-debt` carries it.

### Scope: in-lesson, not course-wide

The `<audio>` stays where it is, in `LessonView`, and **navigating away still
stops playback**. Course-wide listening is a different component mounted in the
root layout with its own queue, and the prototype made the size of that visible:
only a surface shaped like this one could survive the trip at all, which is why
B and A were the only candidates that answered it. Nobody has asked to listen
across lessons yet, and it is now the map's biggest remaining question rather
than a detail inside this one.

### Resume: for the length of one visit

A module-level `Map` keyed by topic + lesson + Edition, banked on leaving a
lesson and restored on `loadedmetadata`. **Not `myProgress`**, on purpose: a
learner paused at 2:14 has not completed anything, position-in-audio is not
Progress, and writing it would put a mutation behind every pause. It dies on
reload, which is the right size for what it fixes, which is opening the lesson
list mid-narration and coming back to find nine minutes restarted. Cross-device
resume is a server decision nobody has asked for.

### Deliberately out

Course-wide playback, text highlighting, scrubbing, playback speed, cross-device
resume. None is blocked by anything here; each is a fresh ticket if it is ever
wanted.

### Evidence

`pnpm typecheck` clean, and `narrationDock.ts`'s arithmetic is unit tested (an
audio element reports `NaN` for `duration` until metadata lands, and a frame
past the end for `currentTime`; neither may reach the DOM). The **prototype** was
walked in a browser by the repo owner, which is what chose the variant. The
**production dock** is verified by types, tests and reading the code, NOT walked
in a browser: no dev server was running, and the pilot is admin-gated to one
English lesson of `prophetic-school`. Worth a look there before the gate widens.

<!-- The failing `scripts/bundle-authoring-assets.test.ts` seen in this session
     is a CRLF mismatch in a generated bundle and predates this work; confirmed
     failing on a clean tree. Not this ticket's. -->
