---
type: task
blocked_by: []
---

# Take "View your certificate" off the lesson top bar

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/01-certificate-off-the-lesson-bar.md`

## Question

On a completed course, `CertificateControl` renders a "View your certificate" pill
into the lesson reader's sticky top bar (`ArtifactView.tsx`, the
`courseCompleted && <CertificateControl …>` branch). On a phone that bar is a
fixed `h-12` strip already carrying a truncating course title, so the pill crowds
out the one thing the bar exists for, and it does it on **every lesson** of a
finished course rather than at the moment the certificate is earned.

Take it off that bar and let Home carry it.

**Verified before writing this (2026-08-23): Home already carries it.**
`CourseCertMenu` renders on the completed state of all three course-card kinds in
`Dashboard.tsx` (lines 427, 590 and 743 at the time of writing). So this is a
deletion plus a confirmation, not a build. Do not add a second control to Home.

One thing genuinely left to decide while doing it: whether the reader keeps *any*
certificate affordance. The only defensible place is the **last lesson**, where
finishing actually happens (see ticket 02), rather than all of them.

## Done when

The pill is gone from the lesson top bar, a learner on a completed course can
still reach their certificate from Home without being told where to look, and the
`## Answer` records whether the last lesson kept a CTA and why.

## Answer

**Removed, 2026-08-23**, as part of shipping the mobile bottom nav (variant D;
record in `.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`). The
`courseCompleted && <CertificateControl>` branch is gone from `LessonView`'s bar
in `ArtifactView.tsx`, and Home carries the certificate instead.

- **The last lesson keeps NO certificate CTA in the reader.** The moment of
  finishing is already served twice without one: the FAB on the last lesson of a
  completed course now reads "Finish course" (ticket 02), and
  `CompletionCelebration` fires from `CourseShell` when the caller becomes
  eligible, itself offering the claim. A third door in the lesson bar is what
  this ticket existed to remove.
- **`PublicReader.tsx` never carried the pill** (verified by reading it: no
  `CertificateControl` reference; a Guest has no account to claim against).
- **`CertificateControl` keeps live call sites**: the owner card's kebab
  (`CourseCardActions.tsx`, where it replaced the standalone `CourseCertMenu` on
  owned cards) and `Certificate.tsx`'s own surfaces. `CourseCertMenu` still
  serves the shared and purchased cards.

Evidence: verified by reading the code plus `pnpm typecheck` and the test suite.
**Not walked in a browser** (the two walk items below stay unticked); the next
phone-width session should glance at Home and a completed course's last lesson.

## Todo

- [ ] Confirm in a browser that Home offers the certificate on a completed course,
      for all three card kinds (owned, shared, purchased).
- [x] Remove `CertificateControl` from the `LessonView` top bar in
      `src/app/_components/ArtifactView.tsx`.
- [x] Decide whether the last lesson keeps a certificate CTA; record the call in
      the `## Answer` either way.
- [x] Check `PublicReader.tsx` for the same control. It is a near line-for-line
      fork of `CourseShell.tsx`, so a guest reader may carry the same pill.
- [x] Confirm `CertificateControl` still has at least one live call site, or
      delete it too rather than leaving a dead export.
- [ ] Walk a completed course at phone width: first lesson and last, plus Home.

## Notes

- `CertificateControl` and `CourseCertMenu` are two different components in
  `Certificate.tsx` with overlapping jobs (a pill vs a menu). Collapsing them is
  **not** this ticket; it is duplication of the kind
  [ui-overhaul ticket 06](../../ui-overhaul/tickets/06-collapse-duplication.md)
  exists to rule on.
- The completion celebration (ADR 0015) is a separate surface and fires from
  `CourseShell`. Leave it alone.
