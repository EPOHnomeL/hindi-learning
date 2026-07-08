# Provider choice + fire-routing skeleton

Status: ready-for-agent

> First slice of the OpenRouter provider line. See
> [`../PRD.md`](../PRD.md) and
> [ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md).
> Walking skeleton: establishes the whole seam with no LLM call yet.

## What to build

Give a course a **Provider** (`claude` or `openrouter`) chosen at creation, and
route the authoring *fire* on that provider — reusing the existing gate/lock/
report orchestration unchanged.

- Add `provider` to the `topics` table (optional; absent reads as `claude`, so
  existing courses and the legacy Hindi course are unaffected).
- The course-creation flow (`seedTopic` + the dashboard create UI) lets the
  owner pick Claude or OpenRouter, **defaulting to Claude**. The OpenRouter
  option is clearly labelled experimental.
- The authoring fire step branches on the course's provider: `claude` keeps
  POSTing the claude.ai routine fire URL (today's behavior); `openrouter`
  schedules a new internal authoring action for the topic instead. No `claim`
  protocol on the OpenRouter path (the action receives its topic directly).
- The scheduled OpenRouter action is **minimal in this slice** — it does no LLM
  work; it exists to prove the schedule → run → `report*` round-trip and leave
  the lock in a clean state (e.g. reports `nothing`/`failed` deterministically).

This is the walking skeleton: creating an OpenRouter course and firing it must
exercise the new path end-to-end without touching the Claude path.

## Acceptance criteria

- [ ] A course can be created as `claude` or `openrouter`; the choice persists on the topic.
- [ ] The create UI defaults to Claude and marks OpenRouter as experimental.
- [ ] Existing courses and the Hindi course behave exactly as before (read as `claude`).
- [ ] Firing a `claude` course still POSTs the routine fire URL (unchanged).
- [ ] Firing an `openrouter` course schedules the internal authoring action and does **not** POST the URL.
- [ ] The gate/lock (`tryAcquireGeneration`) and `reportGeneration` are reused unchanged; the skeleton action leaves the lock clean.
- [ ] Tests cover: provider persisted on `seedTopic`; fire branches on provider (schedule vs POST); Claude path untouched.

## Blocked by

- None — can start immediately.
