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
| [`progress`](/convex/schema.ts) | capture | Per-lesson `opened → completed`, one row per (Topic, User, Lesson). Every reader tracks their own via `by_topic_user_lesson`; the gate reads the *owner's* rows. |
| [`questions`](/convex/schema.ts#L165-L174) | capture | An unprompted [[Question]]: `open → answered`, with the teacher's `reply`. |
| [`generation`](/convex/schema.ts#L131-L150) | lock | The [Teaching Routine](03-teaching-routine.md)'s single-flight lock. See that page. |
| [`shares`](/convex/schema.ts) | grant | A [[Share]] to one [[Edition]] (Topic × `lang`), `role` viewer/editor. See [Access & Sharing](05-access-sharing.md). |
| [`pendingShares`](/convex/schema.ts) | grant | An invite to an email with no account yet; becomes a Share on sign-up. |
| [`publicLinks`](/convex/schema.ts) | grant | Per-Edition [[Public link]] token for [[Guest]]s ([ADR 0013](/docs/adr/0013-public-link-shares.md)). |
| [`certificates`](/convex/schema.ts) | proof | An immutable earned [[Certificate]], one per (User, Topic) ([ADR 0015](/docs/adr/0015-course-completion-and-certificates.md)). |
| [`translations`](/convex/schema.ts) | projection | A translated item of an Edition; a **missing** row ⇒ English fallback. |
| [`translationJobs`](/convex/schema.ts) | lock | One per (Topic, `lang`): the Editions panel status **and** the translate single-flight lock. |
| [`whitelist`](/convex/schema.ts#L17-L20) | gate | The [[Allowlist]]. See [Access & Sharing](05-access-sharing.md). |

The `topics` row also carries `provider` (`claude`/`openrouter`, [ADR 0014](/docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)),
`estimatedLessons` (advisory forecast, [ADR 0018](/docs/adr/0018-lesson-count-estimate-advisory.md)),
`publicToken` (legacy English Public link), and `emblem` ([ADR 0017](/docs/adr/0017-topic-emblem-on-certificates.md)).

## Content API

All learner-facing reads resolve the Topic through one of two helpers in
[topicAccess.ts](/convex/topicAccess.ts) — `getOwnedTopic` for writes (owner-scoped) and `getViewableTopic`
for reads (owner **or** [[Viewer]] via a Share). This is the one authorization seam.

**Reads** ([content.ts](/convex/content.ts#L27-L180)): `listTopics`, `dashboard` (cards with live
lesson/completed counts via [`topicLessonCounts`](/convex/progressCounts.ts)), `listLessons` /
`getLesson` (non-superseded only), `listReferences` / `getReference`.

**Learner writes** ([content.ts](/convex/content.ts#L75-L115)): `seedTopic` ([[Seed]] a Topic from a
title + "why"), `editMission`, `renameTopic` (title only — slug is immutable, the publish/routine key).

**Publish writes** ([content.ts](/convex/content.ts#L189-L310), all `PUBLISH_SECRET`-guarded via
[`assertAdmin`](/convex/adminSecret.ts)): `ensureTopic`, `publishMission`, `publishLesson`,
`publishLearningRecord`, `upsertReference`. These are the Hub end of the
[publish path](04-publishing-workspace.md).

## Content storage: HTML lives in a blob, not a column

Rendered [[Lesson]]/[[Reference]] HTML is stored as an immutable **content blob** in Convex File
Storage — the row carries `htmlStorageId → _storage`, not an inline `html` string. Bodies are served
over a custom [`GET /content?id=<storageId>`](/convex/http.ts) route (`Cache-Control: immutable`,
`ACAO:*`) and fetched client-side by the [Reader](02-reader.md). The storageId is an unguessable bearer
capability minted only *after* a query authorises the caller, so the route needs no per-request auth.
The publish path uploads the HTML to storage first (`generateContentUploadUrl`) and passes only the id
into the mutation, so HTML never rides through a Convex function. (The old inline `html` column was
migrated out — see [backfill.ts](/convex/backfill.ts); only some transitional `translations` rows still
carry inline `html`, and [`pickContentBody`](/convex/contentBlobs.ts) serves whichever is present.)

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
  never leak. The global `topicBySlug` ([topicAccess.ts](/convex/topicAccess.ts)) is only for the publish
  path and the still-global Routine.
- **Optional fields are legacy accommodations**, not real optionality — `ownerId`, `seq`, `status`,
  `seed`, `mission` are optional purely so the pre-existing Hindi row survived the schema push.
