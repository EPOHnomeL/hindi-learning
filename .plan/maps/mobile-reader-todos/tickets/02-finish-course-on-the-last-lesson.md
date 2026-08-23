---
type: task
blocked_by: []
---

# Call it "Finish course" on the last lesson

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/02-finish-course-on-the-last-lesson.md`

## Question

The learner marks a lesson done with a green floating button reading "Mark
complete". On the **last** lesson that click is not marking a lesson, it is
finishing the course: it is the click that makes a certificate claimable. The
label should say so.

Three things make this less trivial than it reads, all verified 2026-08-23:

1. **The FAB label is hardcoded English.** `ArtifactView.tsx` line 592 is a literal
   `<span>Mark complete</span>`, while the desktop button beside it uses
   `t("markComplete")`. So this ticket has to close an existing i18n hole, not just
   swap a string. Every chrome locale needs the new key.
2. **"Last lesson" is not the same as "no next lesson".** On an `active` course the
   last *published* lesson is not the end of the course, it is the Frontier, and
   another lesson may be drafted tomorrow. Telling that learner they finished the
   course would be a lie. The label may only change when the course is `completed`
   (ADR 0015) **and** the lesson is the last one.
3. **"Finish course" already means something else to an owner.** `CourseSettings`
   has an owner-facing "Mark complete" that ends authoring (ADR 0015). One phrase
   must not come to mean both "I have finished reading this" and "stop generating
   lessons". If "Finish course" reads ambiguously against that, pick wording that
   does not, and say why in the `## Answer`.

## Done when

On the last lesson of a completed course the learner's button reads "Finish
course" (or the agreed wording), it is translated in every shipped locale, every
other lesson still reads "Mark complete", and an in-progress course never shows
the finishing label.

## Answer

**"Finish course" shipped, 2026-08-23**, wired through i18n in all five locales
(`Artifact.finishCourse`), alongside the bottom-nav landing (record in
`.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`).

- Both the FAB and the desktop top-bar button read
  `courseCompleted && !nextLessonKey ? finishCourse : markComplete`, so an
  active course's Frontier still says "Mark complete": another lesson may be
  drafted tomorrow, and "finish" there would be a lie. The FAB's hardcoded
  English `Mark complete` is gone with it (the i18n hole this ticket named).
- Placement moved under this ticket's feet, as its Notes anticipated: the
  end-of-lesson card (`LessonFoot.tsx`) absorbed marking-complete on every
  lesson WITH a next lesson, so the FAB now renders only where the finishing
  label matters, the last lesson and the Frontier, lifted above the tab bar.
- **The already-completed state keeps `t("completed")`** ("✓ Completed") on the
  last lesson too. It states a fact about the lesson, not an action, and
  inventing a "Course finished" variant here would duplicate what
  `CompletionCelebration` and Home already announce.
- **No collision with the owner's "Mark complete" in Course settings**: that
  control ends *authoring* (ADR 0015) and lives behind a confirm dialog labelled
  "Mark this course complete"; this one is the learner's own reading progress,
  in the reader. "Finish course" appears only where the reader has read
  everything else, so the phrase cannot be reached in an authoring frame of
  mind. Wording deliberately avoids "complete" to keep the two apart.

Evidence: verified by reading the code, `pnpm typecheck`, the full test suite,
and the locale parity test. **Not walked in a browser**; the walk item below
stays for the next phone-width session.

## Todo

- [x] Add the new key to `messages/en.json` and every other locale file.
- [x] Replace the hardcoded `Mark complete` string on the FAB with the translated
      key, so both states go through i18n.
- [x] Gate the label on `courseCompleted && !nextLessonKey`, not on
      `!nextLessonKey` alone.
- [x] Check the already-completed state too: the button currently flips to
      `t("completed")`, which may want its own wording on the last lesson.
- [x] Confirm the wording does not collide with the owner's "mark complete" in
      Course settings; record the reasoning.
- [ ] Walk it at phone width on three courses: active mid-course, active on the
      Frontier, and completed on the last lesson.

## Notes

- The desktop top-bar button is `hidden md:inline-flex`, so on mobile the FAB is
  the *only* way to mark a lesson complete. Whatever wording lands has to work in
  both places.
- If the bottom-nav prototype absorbs this button into an end-of-lesson card, this
  ticket still holds: it is about the words, not the placement.
