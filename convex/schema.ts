import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// The Hub, as Convex tables (see PRD §4). Local workspace files (lessons/,
// references/) remain the source of truth; `pnpm run publish` mirrors them
// here. Capture tables (responses/progress/questions) are written by the
// reader as the learner reads. Auth tables come from Convex Auth.
export default defineSchema({
  ...authTables,

  // A subject space, owned by its creator. `ownerId` is optional only so the
  // schema push accepts the pre-existing unowned Hindi row; `ensureTopic`
  // backfills it. `seq` orders a user's Topics in the switcher. `by_slug` stays
  // for the operator publish path and the still-global routine (issue 05).
  topics: defineTable({
    slug: v.string(),
    title: v.string(),
    ownerId: v.optional(v.id("users")),
    seq: v.optional(v.number()),
    // Seed flow (issue 07): a learner Seeds a Topic (title + "why"); the Routine
    // drafts the Mission and flips `seeded` → `active`. `status` is optional so
    // the legacy hindi row (pre-seed) is accepted; issue 09 sets it `active`.
    seed: v.optional(v.string()),
    mission: v.optional(v.string()),
    status: v.optional(v.union(v.literal("seeded"), v.literal("active"))),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_slug", ["ownerId", "slug"]),

  // Immutable once published. A replacement carries `supersededBy` (the key of
  // the lesson that retired it). `key` is the filename stem, e.g.
  // "0001-blessed-is-the-man"; `seq` is its order.
  lessons: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    title: v.string(),
    html: v.string(),
    supersededBy: v.optional(v.string()),
  })
    .index("by_topic_seq", ["topicId", "seq"])
    .index("by_topic_key", ["topicId", "key"]),

  // A learner-uploaded Resource (PDF, etc.). Only the raw blob is stored here
  // (issue 04); `processed` (a manifest of rendered/extracted artifacts) is
  // filled lazily by the Routine on first need (issue 06). Dedupe by
  // `(topicId, contentHash)` where contentHash is the blob's _storage sha256.
  resources: defineTable({
    topicId: v.id("topics"),
    ownerId: v.id("users"),
    filename: v.string(),
    rawStorageId: v.id("_storage"),
    contentHash: v.string(),
    status: v.union(v.literal("raw"), v.literal("processing"), v.literal("ready")),
    kind: v.union(v.literal("file"), v.literal("url")),
    processed: v.optional(v.any()),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_hash", ["topicId", "contentHash"]),

  // Mutable: edited in place and re-published; current version always wins.
  // `contentHash` lets publish skip unchanged references.
  references: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    title: v.string(),
    html: v.string(),
    contentHash: v.string(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_key", ["topicId", "key"]),

  // The learner's first answer to a quiz, recorded automatically. `topicId` is
  // optional only for the widen→backfill window (issue 03); narrow once prod is
  // backfilled. Indexes lead with `topicId` so identical lessonKeys across
  // Topics never collide.
  responses: defineTable({
    userId: v.id("users"),
    topicId: v.optional(v.id("topics")),
    lessonKey: v.string(),
    quizId: v.string(),
    answer: v.string(),
    correct: v.boolean(),
  })
    .index("by_topic_user_lesson_quiz", ["topicId", "userId", "lessonKey", "quizId"])
    .index("by_topic", ["topicId"]),

  // Per-lesson reading state. `by_topic_lesson` lets the Routine's gate ask "is
  // this Topic's lesson completed?" without a user (the daily cron has none); a
  // Topic has one owner, so any completed row for it is the owner's.
  progress: defineTable({
    userId: v.id("users"),
    topicId: v.optional(v.id("topics")),
    lessonKey: v.string(),
    status: v.union(v.literal("opened"), v.literal("completed")),
  })
    .index("by_topic_user_lesson", ["topicId", "userId", "lessonKey"])
    .index("by_topic_lesson", ["topicId", "lessonKey"]),

  // The next-lesson Routine's single-flight lock, one row per Topic (see ADR
  // 0008). `frontierKey` is the lesson the in-flight (or last) run fired for;
  // with `status: "caughtUp"` it debounces re-fires until the Frontier advances.
  // `startedAt` backstops a crashed run that never reports (stale → re-fireable).
  generation: defineTable({
    topicId: v.id("topics"),
    status: v.union(
      v.literal("idle"),
      v.literal("generating"),
      v.literal("failed"),
      v.literal("caughtUp"),
    ),
    frontierKey: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // The fire body is closed (ADR 0008), so a fired run learns its Topic by
    // calling `claimWork`, which stamps `claimedAt`/`runId` on one locked-but-
    // unclaimed row. Lets fire-all hand each concurrent run a distinct Topic.
    claimedAt: v.optional(v.number()),
    runId: v.optional(v.string()),
    // Last on-demand (button) fire, for the per-Topic manual cooldown (issue 08)
    // — the daily cron stays the primary authoring path. Survives reports.
    lastManualFireAt: v.optional(v.number()),
  }).index("by_topic", ["topicId"]),

  // A question the learner asked from inside a lesson; the teacher replies.
  questions: defineTable({
    userId: v.id("users"),
    topicId: v.optional(v.id("topics")),
    lessonKey: v.string(),
    text: v.string(),
    status: v.union(v.literal("open"), v.literal("answered")),
    reply: v.optional(v.string()),
  })
    .index("by_topic_user", ["topicId", "userId"])
    .index("by_topic_status", ["topicId", "status"]),
});
