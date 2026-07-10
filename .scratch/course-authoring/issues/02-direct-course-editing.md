# 02 — Direct (manual) course editing

Status: needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Reference, Mission, Resource, Frontier). Relates to [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons, mutable References). The **AI-assisted** counterpart is [issue 01](01-ai-assisted-course-editing.md) — this is the hands-on, direct-manipulation path.

## Want

Let a course owner **edit their course directly** in the app — by hand, not by instructing the AI (that's [issue 01](01-ai-assisted-course-editing.md)). Extend the editing that already exists into a real course-editing surface.

## What exists today

[`CourseSettings.tsx`](../../../src/app/_components/CourseSettings.tsx) already lets the owner: **rename** the Topic, **edit the Mission**, set the **Emblem**, and manage the **Completion** lifecycle. The gaps below are what "edit the course" still lacks.

## Example fixes (real cases)

Two real defects found while reviewing the **Afrikaans Edition** of a course. The **root cause** was fixed in the `translate` skill's fidelity rules ([`.agents/skills/translate/SKILL.md`](../../../.agents/skills/translate/SKILL.md), commit `9b9fdcb`) so *future* translations get it right — but the **already-published Editions still carry the errors**, and today the only remedy is a **full re-translate** of the whole Edition (the panel's retry). These are exactly the small, targeted corrections a direct editor should let an owner make **in place**:

1. **Untranslated concept terms.** The Afrikaans Edition left the English study-science terms *storage strength*, *spacing*, and *interleaving* untranslated — in an `<h2>` heading and in running prose — even though sibling terms were translated (*retrieval* → *herwinning*). The owner wants to fix just those items, not re-run the translation.
2. **Scripture back-translated instead of quoted.** Bible verses in a non-English Edition were re-translated from the English source rather than quoting the target language's commonly-used **published** Bible translation (e.g. the Afrikaanse Bybel). The owner wants to paste the correct published wording into the affected verses.

Both are edits to a **translated Edition item** (a `translations` row keyed `(topicId, lang, kind, key)`), **not** to the English source — a scope the acceptance below must cover, since direct editing today stops at the source course. See the course-translation feature ([`docs/translation.md`](../../../docs/translation.md)).

## Acceptance (to refine at triage)

- **Reorder Lessons**, and **retire / hide** a Lesson from the course view. Lessons stay **immutable** (ADR 0003): "delete a Lesson" = retire/hide it; "edit a Lesson" = supersede it with a revised one — never mutate in place.
- **Edit References** in place (References are mutable per ADR 0003).
- **Manage Resources post-seed** — add/remove the sources a course is grounded in after the initial Seed.
- Edit **quiz Questions** inside a Lesson (delete/rewrite) — respecting Lesson immutability (supersede, not mutate).
- **Edit a translated Edition item in place** — correct an individual translated title / Lesson / Reference of an Edition without a full re-translate (see [Example fixes](#example-fixes-real-cases)). The English source and each Edition are edited independently; an edit to a Lesson's translated HTML must still pass the positional quiz-structure guard (`publishTranslation`), same as a routine-published translation.
- All edits are **owner-only**; a **review/approve gate** applies before shared / company-wide readers see changes (shared with [issue 01](01-ai-assisted-course-editing.md) — the gate does not exist today; Lessons auto-publish).
- An owner edit never silently changes content a reader has already completed without a visible version bump.

## Depends on

- The **review/approve gate** (new — Lessons auto-publish today), shared with [issue 01](01-ai-assisted-course-editing.md).

## Notes

- Distinct from [issue 01](01-ai-assisted-course-editing.md) (AI-assisted "direct and build"). This ticket is the manual editor: buttons and forms, no agent.
- To-scope only; not built.

## Comments

- 2026-07-10 — Migrated to GitHub issue [#17](https://github.com/EPOHnomeL/hindi-learning/issues/17); GitHub is now the tracking home for this ticket.
