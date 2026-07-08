# 01 — AI-assisted course editing (author edits a course via AI)

Status: open (deferred post-demo) — the review/approve gate + edit-intents are not built (lessons auto-publish)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Reference, Question, Routine, Frontier). Relates to [ADR 0001](../../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md) (no LLM in the web app), [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons), and [ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) (the programmatic runtime that makes a live authoring agent feasible).

## Want

Today a course author can only **Seed** a Topic once (title + "why" + Resources) and let the Routine author everything autonomously ("seed-and-go"). We want an author to be able to **revise an existing course by instructing the AI** — e.g. "remove this lesson", "add a module on X", "delete this quiz question", "rewrite lesson 3 simpler", "reorder these". This is the "direct and build" experience, and the upgrade from seed-and-go.

## Acceptance (to be refined at triage)

- The author can issue **edit-intents** against an existing Topic's content:
  - retire/hide a Lesson from the course view,
  - add a Lesson or module on a named subject,
  - delete or rewrite a quiz Question inside a Lesson,
  - reorder Lessons.
- Edit-intents are **structured directives**, not free-form reader chat (keeps the reader dumb, ADR 0001).
- Lessons stay **immutable** (ADR 0003): "edit a lesson" = supersede with a revised one; "delete" = retire/hide it.
- Changes land in a **draft/review** state; the author **approves** before the change reaches employees. (This review/approve gate does **not** exist today — Lessons currently auto-publish — so it is part of this issue.)
- An author edit never silently mutates content an employee has already completed without a visible version bump.

## Open decision (carried from the grilling)

Two delivery shapes were weighed and **not** decided:

1. **Async edit-intents** (lower risk, matches ADR 0001): the author leaves directives; the Routine applies them on its next run; the author reviews and approves. No live agent in the app.
2. **Live chat-to-build studio** (higher wow, bigger build): the author directs the agent in real time and watches the course change, then approves. Bends ADR 0001 and adds a live-agent cost/latency surface. ADR 0014's programmatic runtime is what makes this feasible.

Pick the shape at triage.

## Depends on

- The **review/approve gate** (new — Lessons auto-publish today).
- For shape (2): [ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) (programmatic, provider-agnostic runtime).

## Notes

- v1 / the company demo deliberately stays **seed-and-go**; this issue is the post-demo authoring upgrade.
- The review gate is independently valuable the moment a course is shared company-wide, even before AI editing lands.
