# Ongoing single-pass lesson authoring (GLM 4.2)

Status: done — shipped 1bf91d6, 996cd2d (single-pass authoring + mission-draft/materialise seam).

> The core authoring path for an OpenRouter course that already has a Frontier.
> See [`../PRD.md`](../PRD.md).

## What to build

When an OpenRouter course's Frontier is completed and the fire lands, the
internal authoring action authors the next Lesson in a **single pass** on
GLM 4.2 and publishes it — reproducing the `teach` skill's output shape via the
ported instructions (Option A).

- Read the topic's full context via the internal materialise seam (prior
  lessons, references, learning records, resources, progress, mission).
- Build one prompt: the bundled teach instructions as the system prompt + the
  materialised context; ask for the next Lesson as a lean HTML fragment in the
  authoring format. No web search in this slice.
- Wrap the fragment into a stored document and run `shuffleQuizOptions` (the same
  helper the CLI publish path uses), then publish via the existing
  `publishLesson` mutation, plus a learning record via `publishLearningRecord`.
- Report the run through the existing `reportGeneration` (`published` on success
  with the `~N` estimate; `failed` on error so the reader shows a retry).

The single-pass generator judges the next ZPD step from the injected context;
it does not self-refine or reuse asset files (a shared style is inlined).

## Acceptance criteria

- [ ] Completing the Frontier on an OpenRouter course produces the next Lesson, visible in the reader alongside prior lessons.
- [ ] The published lesson is wrapped consistently (shared head/foot) and its quiz options are shuffled; quizzes score correctly.
- [ ] A learning record is published for the authored lesson.
- [ ] Success reports `published` (with an estimate) via `reportGeneration`; the lock clears.
- [ ] An error (model/publish failure) reports `failed` and surfaces as retryable in the reader; the lock does not get stuck.
- [ ] Tests cover the wrap+shuffle step and the publish wiring against a mocked OpenRouter client; model output is not asserted.
- [ ] Behavior verified live on a dev deployment with `OPENROUTER_API_KEY` set (build env has no key).

## Blocked by

- [02 — OpenRouter client + bundled authoring assets](./02-openrouter-client-and-bundled-authoring-assets.md)
