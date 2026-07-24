# lesson-estimate/02: Teach SKILL.md estimate note (routine-prompt + ADR 0018 shipped)

**Status:** open — routine-prompt + teach SKILL note + ADR 0018 not written
**Depends on:** [01 — `~N lessons` estimate, end-to-end](./01-estimate-end-to-end.md)
**Imported:** from GitHub #30 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/lesson-estimate/issues/02-teacher-emits-estimate-and-adr.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/lesson-estimate/issues/02-teacher-emits-estimate-and-adr.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Parent: [PRD: Estimated lesson count](../PRD.md)

Wire the *producer* of the estimate and record the decision, so the plumbing
from Slice 01 actually fires in production.

## Scope

- The canonical Routine instructions (`docs/routine-prompt.md`) tell the Routine
  to emit its best-guess **total** Lesson count for the course at the end of each
  run, via the `report … --estimate <n>` flag added in Slice 01.
- The teach skill (`SKILL.md`) gains a short note framing the estimate: it is a
  **soft** forecast the teacher revises freely each run, a **total** (not
  remaining), and it must **never** be authored *up to* — termination stays a
  Mission judgement, so the existing "Terminating a Course" rules are unchanged.
- A short advisory ADR (**0018**) records that the estimate is display-only and
  must never become a lesson quota (guarding against a future change that "fixes"
  the Routine into authoring to the number). It cross-links ADR 0015, which stays
  unchanged.

No code and no tests — this is the agent contract plus one decision record.

## Acceptance criteria

- [ ] `docs/routine-prompt.md` instructs the Routine to emit its best-guess total via `report … --estimate <n>` each run, as part of (or beside) the existing report step.
- [ ] Teach `SKILL.md` notes the estimate is soft, a total, revised freely, and never authored up to; the "Terminating a Course" section is unchanged.
- [ ] ADR 0018 exists, states the estimate is advisory / display-only and must never become a quota, and cross-links ADR 0015.
- [ ] ADR 0015 is left unchanged.
- [ ] Wording is consistent with Slice 01's flag name and semantics (a whole-number total).

## Comments

### EPOHnomeL — 2026-07-10

**Verified 2026-07-10 (main @ 1b2db94) — mostly shipped since the 2026-07-08 audit; retitled to the remaining scope.**

Already shipped: docs/routine-prompt.md:99-113 documents `report … --estimate <n>` (soft forecast, not a quota) with the backing plumbing live (`reportGeneration` patches `estimatedLessons`, routine.ts:216-234; dashboard displays it), and ADR 0018 (`docs/adr/0018-lesson-count-estimate-advisory.md`) exists, cross-linking ADR 0015.

**Actual remaining scope:** the teach `SKILL.md` estimate note. Note routine-prompt.md:108 currently cites a SKILL.md section "The Lesson-Count Estimate" that does not exist — a dangling reference this issue should fix.
