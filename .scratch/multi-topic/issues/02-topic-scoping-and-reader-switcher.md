# 02 — Topic scoping + reader switcher (tracer bullet)

Status: done — topic scoping + owner-scoped listTopics + per-slug reader shipped

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md). Spec: [`../PRD.md`](../PRD.md).

## Want

The thinnest end-to-end "two Topics work" slice: publish a second Topic and
switch to it in the reader. Removes the hardcoded single Topic.

## Acceptance

- `topics` gains `ownerId` (`users`), optional `seq`; a `content.listTopics`
  query returns the signed-in user's Topics (owner-scoped).
- All content queries take `topicSlug` and resolve owner + Topic instead of the
  baked-in `TOPIC_SLUG = "hindi"` ([content.ts](../../../convex/content.ts)).
- [Reader.tsx](../../../src/app/_components/Reader.tsx) gets a Topic switcher;
  the hardcoded `"Hindi"` header and `TOPIC_SLUG` are gone; `topicSlug` threads
  through `listLessons`/`getLesson`/`listReferences`/`getReference` and into
  `ArtifactView`.
- With one Topic, the reader behaves exactly as today.

## Depends on

- Nothing (foundation). Capture stays single-user-correct until **03**.

## Notes

- Ownership: a Topic is owned by its creator; child rows (lessons/references)
  inherit the owner via `topicId`. This is the multi-tenant base (PRD §schema).
