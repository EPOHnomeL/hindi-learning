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

<!-- unresolved -->
