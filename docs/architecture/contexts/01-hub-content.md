---
slug: hub-content
name: Hub & Content Model
position: 1
status: draft
adrs: [0003, 0007, 0009]
---

# Hub & Content Model

The [[Hub]] is the Convex backend — the source of truth for both the *content* and the
*conversation* ([ADR 0009](/docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md)).
Two streams write into it: the [[Routine]] mirrors authored [[Lesson]]s, [[Reference]]s, learning
records and the [[Mission]] in via the [Publishing & Workspace](04-publishing-workspace.md) scripts,
while the [Reader](02-reader.md) writes the learner's [[Response]]s, [[Progress]] and [[Question]]s
back as they read. Everything else reads from here.

The whole model lives in one richly-commented file — [schema.ts](/convex/schema.ts#L9-L175) is the
best single thing to read.

## The tables

| Table | Mutability | Notes |
| --- | --- | --- |
| [`topics`](/convex/schema.ts#L26-L40) | mutable | A [[Topic]], owned by one User. `ownerId` optional only to accept the legacy unowned Hindi row; `ensureTopic` backfills it. `status: seeded → active`. |
| [`lessons`](/convex/schema.ts#L45-L54) | **immutable** | A replacement carries `supersededBy` ([ADR 0003](/docs/adr/0003-immutable-lessons-mutable-references.md)). `key` is the filename stem; `seq` orders them. |
| [`references`](/convex/schema.ts#L91-L99) | mutable | Edited in place; `contentHash` lets publish skip unchanged ones. |
| [`resources`](/convex/schema.ts#L61-L73) | lifecycle | A [[Resource]]: a `file` (blob in `_storage`) or a `url`. `raw → processing → ready`. Deduped by `(topicId, contentHash)`. |
| [`learningRecords`](/convex/schema.ts#L80-L87) | append-only | The teacher's per-Lesson notes; ground the next ZPD step. Insert-once like lessons. |
| [`responses`](/convex/schema.ts#L104-L113) | capture | First quiz answer only. Indexes lead with `topicId` so keys never collide across Topics. |
| [`progress`](/convex/schema.ts#L118-L125) | capture | Per-lesson `opened → completed`. `by_topic_lesson` lets the gate ask "completed?" with no user. |
| [`questions`](/convex/schema.ts#L165-L174) | capture | An unprompted [[Question]]: `open → answered`, with the teacher's `reply`. |
| [`generation`](/convex/schema.ts#L131-L150) | lock | The [Teaching Routine](03-teaching-routine.md)'s single-flight lock. See that page. |
| [`shares`](/convex/schema.ts#L156-L162) | grant | A [[Share]]. See [Access & Sharing](05-access-sharing.md). |
| [`whitelist`](/convex/schema.ts#L17-L20) | gate | The [[Allowlist]]. See [Access & Sharing](05-access-sharing.md). |

## Content API

All learner-facing reads resolve the Topic through one of two helpers in
[lib.ts](/convex/lib.ts#L21-L40) — `getOwnedTopic` for writes (owner-scoped) and `getViewableTopic`
for reads (owner **or** [[Viewer]] via a Share). This is the one authorization seam.

**Reads** ([content.ts](/convex/content.ts#L27-L180)): `listTopics`, `dashboard` (cards with live
lesson/completed counts via [`topicLessonCounts`](/convex/lib.ts#L46-L59)), `listLessons` /
`getLesson` (non-superseded only), `listReferences` / `getReference`.

**Learner writes** ([content.ts](/convex/content.ts#L75-L115)): `seedTopic` ([[Seed]] a Topic from a
title + "why"), `editMission`, `renameTopic` (title only — slug is immutable, the publish/routine key).

**Publish writes** ([content.ts](/convex/content.ts#L189-L310), all `PUBLISH_SECRET`-guarded via
[`assertAdmin`](/convex/lib.ts#L7-L10)): `ensureTopic`, `publishMission`, `publishLesson`,
`publishLearningRecord`, `upsertReference`. These are the Hub end of the
[publish path](04-publishing-workspace.md).

## Resource lifecycle

Upload → [`recordUploadedResource`](/convex/resources.ts#L14-L41) computes the blob's sha256, checks
`by_topic_hash`, and **deletes the redundant blob** if the bytes already exist. The Routine later
fills the `processed` manifest and flips to `ready` via
[`cacheProcessedResource`](/convex/resources.ts#L131-L150) (idempotent). URL resources dedupe on the
URL string itself.

## Gotchas

- **Lessons are immutable.** Re-publishing the same `(topicId, key)` is a silent no-op
  ([content.ts:244](/convex/content.ts#L231-L260)). To "fix" a lesson you author a new one that
  `supersedes` the old. References are the opposite — mutable, upserted by `contentHash`.
- **Reads are owner-scoped by `(ownerId, slug)`**, not by slug alone, so identical slugs across users
  never leak. The global `topicBySlug` ([lib.ts:12](/convex/lib.ts#L12-L17)) is only for the publish
  path and the still-global Routine.
- **Optional fields are legacy accommodations**, not real optionality — `ownerId`, `seq`, `status`,
  `seed`, `mission` are optional purely so the pre-existing Hindi row survived the schema push.
