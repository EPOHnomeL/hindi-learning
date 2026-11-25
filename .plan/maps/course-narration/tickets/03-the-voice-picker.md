---
type: prototype
blocked_by: []
claimed_by: claude-1ee12cbe
claimed_at: 2026-11-24T22:59:16+02:00
---
# The voice picker: how a learner chooses between Michael and Emma

## Question

[Ticket 02](02-kokoro-recordings-two-voices.md) records every lesson in two
voices. The owner asked (2026-11-24) to "let users choose between kokoro michael
and kokoro emma". Where does that choice live on screen, and what does it look
like?

What is already settled by the data path, so the prototype does not reopen it:

- `lessonAudio.status` returns `voice` (the one playing) and `voices` (the ones
  this lesson is recorded in, in casting order). `useLessonNarration` hands both
  to the reader along with `onVoice(voice)`.
- The choice is remembered per device, in `localStorage` under
  `hindi:narrationVoice`. Not on the server: that would be a schema change for a
  taste nobody has asked to follow them between devices.
- Changing voice mid-lesson carries on from the same share of the track
  (`carryOver` in `narrationDock.ts`), and keeps playing if it was playing.
- A lesson recorded in only one voice plays that one whatever was chosen, so a
  picker with a single option should not be drawn at all.

What is open:

- **Where.** The docked bar (ticket 01) is the only narration surface that stays
  on screen, but it appears only once playback has been asked for, so a picker
  there cannot be used BEFORE the first press. The in-lesson play control is
  inside the sandboxed lesson frame (`NARRATE_BRIDGE`), where a second control
  costs a postMessage round trip and a slot beside the authored subtitle.
- **What.** The earlier session's suggestion was a two-segment "Michael | Emma"
  control in the docked bar. Alternatives worth seeing beside it: a single button
  naming the current narrator that flips to the other, or a small menu that would
  survive a third voice.
- **Naming.** "Michael" and "Emma" are Kokoro's own names for the voices. Whether a
  learner should see those, or a description ("American, male" and "British,
  female"), is a product call.

**The owner's reaction, 2026-11-25**, after being sent a three-variant mock (two
segments in the dock, one chip that flips, words under the lesson heading), in his
words: "what about adding a settings cog where they can choose male or female in
the popup". So none of the three as drawn: a cog that opens a small popup, and the
two options are labelled **Male** and **Female**, not "Michael" and "Emma". That
settles Naming. Still open, and not to be guessed: where the cog sits (the dock
appears only after the first press, so a cog there cannot be used before it), and
what the popup looks like. Next step is a mock of the cog and popup for him to
open, not code in `src/`.

**Built, 2026-11-25.** He was sent a second mock with the cog in three places (the
player bar, the lesson's title bar, beside the play button) and answered "A": the
player bar. Built to match in `NarrationDock` (`ArtifactView.tsx`) and deployed
in commit `e74ad29`. Evidence so far: typechecked, and reviewed by reading (the
review's three confirmed faults are fixed in that commit). NOT walked in a
browser by anyone. This ticket stays open until he has pressed it on a live
lesson, which is the last line of Done-when.

**This is a HITL prototype.** CLAUDE.md is explicit that a prototype is not decided
until the human has actually seen it: show the owner something he can open (an
Artifact is enough) BEFORE any picker is written into `src/`, and resolve this
ticket only after his reaction, never on a description of the code.

## Done when

The owner has looked at the variants and picked one, the picker is built to match,
and he has pressed it on a lesson recorded in both voices.
