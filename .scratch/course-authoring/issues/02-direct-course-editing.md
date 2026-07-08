# 02 — Direct (manual) course editing

Status: needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Reference, Mission, Resource, Frontier). Relates to [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons, mutable References). The **AI-assisted** counterpart is [issue 01](01-ai-assisted-course-editing.md) — this is the hands-on, direct-manipulation path.

## Want

Let a course owner **edit their course directly** in the app — by hand, not by instructing the AI (that's [issue 01](01-ai-assisted-course-editing.md)). Extend the editing that already exists into a real course-editing surface.

## What exists today

[`CourseSettings.tsx`](../../../src/app/_components/CourseSettings.tsx) already lets the owner: **rename** the Topic, **edit the Mission**, set the **Emblem**, and manage the **Completion** lifecycle. The gaps below are what "edit the course" still lacks.

## Acceptance (to refine at triage)

- **Reorder Lessons**, and **retire / hide** a Lesson from the course view. Lessons stay **immutable** (ADR 0003): "delete a Lesson" = retire/hide it; "edit a Lesson" = supersede it with a revised one — never mutate in place.
- **Edit References** in place (References are mutable per ADR 0003).
- **Manage Resources post-seed** — add/remove the sources a course is grounded in after the initial Seed.
- Edit **quiz Questions** inside a Lesson (delete/rewrite) — respecting Lesson immutability (supersede, not mutate).
- All edits are **owner-only**; a **review/approve gate** applies before shared / company-wide readers see changes (shared with [issue 01](01-ai-assisted-course-editing.md) — the gate does not exist today; Lessons auto-publish).
- An owner edit never silently changes content a reader has already completed without a visible version bump.

## Depends on

- The **review/approve gate** (new — Lessons auto-publish today), shared with [issue 01](01-ai-assisted-course-editing.md).

## Notes

- Distinct from [issue 01](01-ai-assisted-course-editing.md) (AI-assisted "direct and build"). This ticket is the manual editor: buttons and forms, no agent.
- To-scope only; not built.
