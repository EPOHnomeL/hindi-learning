# 03 — Reader & dashboard affordances for completion

Status: done — shipped 88a2f83/5b064e4 (card redesign b966347/26a69f8)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Completion**, **Certificate**). Spec: [`../PRD.md`](../PRD.md).

## Want

Wire the completed state into the app chrome: the owner can end/reopen a course,
the reader stops offering "Generate next lesson" on a completed course and offers
the Certificate instead, and the dashboard surfaces completion + a Certificate
link — for owners and for Viewers on shared courses.

## Acceptance

- **Owner controls** — a clearly-labelled "Mark course complete" action on the
  owner's course (course chrome / card), behind a confirmation, calling the
  owner end-course mutation (`01`); and a "Reopen" action on a completed course
  calling reopen (`01`). Both are **absent for Viewers**.
- **Reader swap** — on a completed Topic the `NextLessonButton` affordance is
  replaced by a "View your certificate" control (routes to the in-app Certificate
  view / public page from `05`). On the Frontier of a completed course there is
  no "Generate next lesson".
- **Dashboard (owner)** — the existing `✓ Complete` marker on a completed course
  links to that course's Certificate ("View certificate"). A course reads as
  complete only when `status` is `completed`, not merely when the learner is
  caught up (the buffer-of-one distinction).
- **Dashboard (Viewer)** — a "Shared with me" card for a completed Topic the
  Viewer has finished shows the Viewer's own completion and a "View certificate"
  link (their own Certificate, not the owner's).
- All new controls read live backend state (`myCertificate` from `02`,
  `topics.status`), so they appear/disappear as the Topic changes without reload.

## Depends on

- `01` (completion state + mutations), `02` (`myCertificate` to decide what to
  show). Links into `05` for the actual Certificate view/page.

## Notes

- The reader currently keys the next-lesson affordance off `isFrontier &&
  completed` in `ArtifactView`; the completed-Topic branch supersedes it.
- No new frontend tests (repo norm); verify manually — owner end→reader swaps→
  reopen restores; Viewer sees no owner controls.
- Covers PRD stories 5 (UI), 6, 7 (UI), 9 (UI absence), 10, 24, 30, 31.
