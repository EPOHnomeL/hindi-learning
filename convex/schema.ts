import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// The Hub, as Convex tables (see PRD §4). Local workspace files (lessons/,
// references/) remain the source of truth; `pnpm run publish` mirrors them
// here. Capture tables (responses/progress/questions) are written by the
// reader as the learner reads. Auth tables come from Convex Auth.
export default defineSchema({
  ...authTables,

  // A subject space. v1 ships a single topic ("hindi").
  topics: defineTable({
    slug: v.string(),
    title: v.string(),
  }).index("by_slug", ["slug"]),

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

  // The learner's first answer to a quiz, recorded automatically.
  responses: defineTable({
    userId: v.id("users"),
    lessonKey: v.string(),
    quizId: v.string(),
    answer: v.string(),
    correct: v.boolean(),
  }).index("by_user_lesson_quiz", ["userId", "lessonKey", "quizId"]),

  // Per-lesson reading state. `by_lesson` lets the Routine's gate ask "is this
  // lesson completed?" without a user (the daily cron has none); v1 is single-
  // learner, so any completed row is the learner's.
  progress: defineTable({
    userId: v.id("users"),
    lessonKey: v.string(),
    status: v.union(v.literal("opened"), v.literal("completed")),
  })
    .index("by_user_lesson", ["userId", "lessonKey"])
    .index("by_lesson", ["lessonKey"]),

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
  }).index("by_topic", ["topicId"]),

  // A question the learner asked from inside a lesson; the teacher replies.
  questions: defineTable({
    userId: v.id("users"),
    lessonKey: v.string(),
    text: v.string(),
    status: v.union(v.literal("open"), v.literal("answered")),
    reply: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});
