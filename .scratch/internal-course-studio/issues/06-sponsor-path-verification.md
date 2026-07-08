# 06 — Sponsor path verification + fixes (cold start → authored draft course)

Status: done — cold-start authoring path (allowlist→seed→author→mission→resource) verified

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Allowlist, Admin, Seed, Topic, Mission, Resource, Routine). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0001](../../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md) (no LLM in the web app — authoring stays seed-and-go).

## What to build

End-to-end **verification** (and fixes for any gaps found) that a non-engineer C-suite sponsor can go from cold start to an authored draft course with no developer help: be added to the Allowlist → register/sign in → **Seed** a Topic (title + "why" + Resource upload) → receive authored Lessons from the Routine → edit the Mission → upload an additional Resource. Surface and fix the UX gaps that would block a non-developer; this is the human-facing acceptance path for the demo.

## Acceptance criteria

- [ ] A new sponsor email can be added to the Allowlist (Admin) and used to register/sign in.
- [ ] The sponsor can Seed a Topic with a title, a free-text "why", and Resource upload(s) from the dashboard.
- [ ] The Routine authors the first Lesson(s) for the Seeded Topic (seed-and-go, unchanged — ADR 0001).
- [ ] The sponsor can edit the Mission text and upload an additional Resource to the Topic.
- [ ] Gaps that block a non-developer from completing this path are fixed (or filed if genuinely out of scope).
- [ ] The full path is demoable cold-start by a non-developer.

## Blocked by

None - can start immediately (best demoed after issue **01** for the draft/publish state and issue **05** for the finished look).
