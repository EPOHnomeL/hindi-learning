# Auto-terminate + estimate + batched reply

Status: ready-for-agent

> Completes the OpenRouter authoring path's parity with the teach skill's
> per-run judgement. See [`../PRD.md`](../PRD.md).

## What to build

Give the OpenRouter authoring run the teach skill's end-of-run behaviors:
terminate a finished course, report the size estimate, and answer open learner
questions — all within the authoring action.

- **Terminate.** Each run, before authoring, judge the course against the
  Mission's "Success looks like" outcomes. When substantially met (or the ZPD is
  exhausted), call the existing `completeCourse` instead of authoring — **no
  emblem** (a completed OpenRouter course falls back to the generic 🎓; the owner
  may set one), then report `nothing`. Respect lifelong/open-ended missions
  (never force-complete).
- **Estimate.** Report the soft `~N` total lesson-count estimate on the run
  (already threaded through `reportGeneration`).
- **Batched reply.** Within the authoring run, answer any open learner questions
  for the topic (single-pass, using the lesson context) via the existing
  `replyToQuestion` mutation — matching the Claude path's delayed cadence.

## Acceptance criteria

- [ ] A run that judges the mission met marks the course `completed` (no emblem) and reports `nothing`; the reader stops offering "Generate next lesson" and an eligible learner can earn a certificate (generic 🎓).
- [ ] A lifelong/open-ended mission is never auto-completed.
- [ ] The run reports a whole-number `~N` estimate that the dashboard shows while building.
- [ ] Open questions on the topic are answered during the authoring run and flip to `answered` in the reader.
- [ ] Tests cover the terminate decision branch (complete vs author), the estimate on the report, and the reply wiring against a mocked client.
- [ ] Behavior verified live on a dev deployment with `OPENROUTER_API_KEY` set.

## Blocked by

- [03 — Ongoing single-pass lesson authoring](./03-ongoing-single-pass-lesson-authoring.md)
