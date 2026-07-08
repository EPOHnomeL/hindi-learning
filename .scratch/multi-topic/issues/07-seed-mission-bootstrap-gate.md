# 07 — Topic creation (Seed) + Mission flow + bootstrap gate

Status: done — Seed form, Mission draft/edit round-trip, and bootstrap gate shipped

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Seed, Mission, Topic). Spec: [`../PRD.md`](../PRD.md).

## Want

Let a learner start a Topic from the dashboard and have the Routine turn that
Seed into a Mission + first Lesson — with no LLM in the web (ADR 0001).

## Acceptance

- Dashboard "start a course": a form taking title + free-text "why" + initial
  Resource upload(s). Creates a `topics` row with `status: "seeded"`, `seed`
  text, and the Resources (issue **04**).
- The gate gains a **bootstrap path**: `tryAcquireGeneration` fires a Topic that
  is `seeded` with **zero Lessons**, in addition to the existing "Frontier
  completed" path ([routine.ts](../../../convex/routine.ts)).
- On a Seeded Topic's first run, the Routine drafts `MISSION.md` from the Seed +
  Resources, publishes it to `topics.mission`, flips `status` to `active`, and
  authors Lesson 1.
- The reader shows the active Topic's Mission; a learner can **edit** the Mission
  text (plain form → `topics.mission`); the edit round-trips into `MISSION.md` at
  the next materialise.

## Depends on

- **02** (scoping), **04** (Resources), **05** (claim + materialise + gate).

## Notes

- Mission editing is not lesson-authoring, so it doesn't violate "no authoring in
  the web" — it's the learner curating their own *why*.
