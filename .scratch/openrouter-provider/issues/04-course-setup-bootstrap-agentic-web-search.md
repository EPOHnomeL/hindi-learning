# Course setup / bootstrap (agentic + web search)

Status: ready-for-agent

> The first-run experience for a new OpenRouter course. Builds on the single-pass
> authoring core from issue 03. See [`../PRD.md`](../PRD.md).

## What to build

When a **seeded** OpenRouter course (a Seed/"why" but no Frontier) is fired, the
authoring action runs a web-grounded, orchestrated bootstrap that drafts the
Mission and authors Lesson 1 — the OpenRouter twin of the teach skill's
bootstrap fire.

- Step 1: draft the **Mission** from the Seed + any uploaded resources, with web
  search enabled (OpenRouter `web` plugin), then publish it via the existing
  `publishMission` (which flips `seeded` → `active`).
- Step 2: author **Lesson 1** with web search enabled, then publish it through
  the same wrap + shuffle + `publishLesson` path from issue 03 (plus its
  learning record).
- Orchestrated in TypeScript (our code drives the steps); bounded by a step
  budget and mindful of the ~10-min action ceiling. Report through
  `reportGeneration` as usual.

## Acceptance criteria

- [ ] Seeding an OpenRouter course and firing setup produces a Mission (course flips to `active`) and a first Lesson.
- [ ] Web search is enabled on the setup calls (grounding is reflected, e.g. cited sources).
- [ ] The bootstrap only runs for a `seeded` OpenRouter course with no Frontier; a course with a Frontier still takes the single-pass path (issue 03).
- [ ] The run stays within the action time ceiling and fails cleanly (reports `failed`, lock clears) if a step exceeds its budget.
- [ ] Tests cover the orchestration order (mission before lesson) and publish wiring against a mocked client.
- [ ] Behavior verified live on a dev deployment with `OPENROUTER_API_KEY` set.

## Blocked by

- [03 — Ongoing single-pass lesson authoring](./03-ongoing-single-pass-lesson-authoring.md)
