# 02 — Teacher emits the estimate + advisory ADR

Status: open — routine-prompt + teach SKILL note + ADR 0018 not written

## Parent

[PRD: Estimated lesson count](../PRD.md)

## What to build

Wire the *producer* of the estimate and record the decision, so the plumbing
from Slice 01 actually fires in production.

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

## Blocked by

- [01 — `~N lessons` estimate, end-to-end](./01-estimate-end-to-end.md)

## Comments

- 2026-07-10 — Migrated to GitHub issue [#30](https://github.com/EPOHnomeL/hindi-learning/issues/30); GitHub is now the tracking home for this ticket.
