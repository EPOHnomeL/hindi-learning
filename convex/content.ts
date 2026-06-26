import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdmin, getOwnedTopic, topicBySlug } from "./lib";

// Lessons & references. Reader queries are auth-gated and owner-scoped: a Topic
// is resolved by (owner = signed-in user, slug), so one learner never sees
// another's content. Publish mutations are called by the teach CLI
// (`pnpm run publish`) and guarded by PUBLISH_SECRET; they resolve the owner
// from `ownerEmail` (the operator has no auth identity) and thread the resulting
// topicId through.

// ---- Reader (learner) ------------------------------------------------------

// The signed-in user's Topics, ordered by `seq` (unsequenced last), then age.
export const listTopics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return topics
      .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a._creationTime - b._creationTime)
      .map((t) => ({ slug: t.slug, title: t.title, seq: t.seq, status: t.status ?? "active", mission: t.mission ?? null }));
  },
});

// The home dashboard: the signed-in user's Topics as cards, each with its live
// lesson count + how many they've completed (for a progress indicator).
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const cards = await Promise.all(
      topics.map(async (t) => {
        const lessons = (
          await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", t._id)).collect()
        ).filter((l) => !l.supersededBy);
        const progress = await ctx.db
          .query("progress")
          .withIndex("by_topic_lesson", (q) => q.eq("topicId", t._id))
          .collect();
        const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
        return {
          slug: t.slug,
          title: t.title,
          status: t.status ?? "active",
          mission: t.mission ?? null,
          seq: t.seq,
          creationTime: t._creationTime,
          lessonCount: lessons.length,
          completedCount: lessons.filter((l) => done.has(l.key)).length,
        };
      }),
    );
    return cards.sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.creationTime - b.creationTime);
  },
});

// Start a Topic from the dashboard: title + free-text "why" (the Seed). The
// Routine turns the Seed into a Mission + first Lesson on its next run; no LLM
// runs here (ADR 0001). Slugs are globally unique (the routine path resolves by
// slug), so identical titles get -2/-3 suffixes.
export const seedTopic = mutation({
  args: { title: v.string(), why: v.string() },
  handler: async (ctx, { title, why }): Promise<{ slug: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "topic";
    let slug = base;
    for (let n = 2; await topicBySlug(ctx, slug); n++) slug = `${base}-${n}`;
    await ctx.db.insert("topics", { slug, title, ownerId: userId, seed: why, status: "seeded" });
    return { slug };
  },
});

// The learner curating their own "why" — editing the Mission text (not authoring
// a Lesson, so it doesn't break "no authoring in the web", ADR 0001). The edit
// round-trips into MISSION.md at the next materialise.
export const editMission = mutation({
  args: { topicSlug: v.string(), mission: v.string() },
  handler: async (ctx, { topicSlug, mission }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { mission });
  },
});

// Rename a Topic's display title. The slug is immutable (the routine + publish
// paths resolve by it), so only `title` changes.
export const renameTopic = mutation({
  args: { topicSlug: v.string(), title: v.string() },
  handler: async (ctx, { topicSlug, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const trimmed = title.trim();
    if (!trimmed) throw new Error("title required");
    await ctx.db.patch(topic._id, { title: trimmed });
  },
});

export const listLessons = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id))
      .collect();
    return lessons
      .filter((l) => !l.supersededBy)
      .map((l) => ({ key: l.key, seq: l.seq, title: l.title }));
  },
});

export const getLesson = query({
  args: { topicSlug: v.string(), key: v.string() },
  handler: async (ctx, { topicSlug, key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return null;
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) return null;
    return { key: lesson.key, seq: lesson.seq, title: lesson.title, html: lesson.html };
  },
});

export const listReferences = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const refs = await ctx.db
      .query("references")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    return refs
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, title: r.title }));
  },
});

export const getReference = query({
  args: { topicSlug: v.string(), key: v.string() },
  handler: async (ctx, { topicSlug, key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return null;
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    return ref ? { key: ref.key, title: ref.title, html: ref.html } : null;
  },
});

// ---- Publish (teach CLI, PUBLISH_SECRET-guarded) ---------------------------

// Resolve the Topic's owner from email, then create the owned Topic or backfill
// `ownerId` on the pre-existing unowned row (the legacy Hindi topic). Returns
// the topicId the rest of the publish run threads through.
// ponytail: by_slug.unique() assumes one Topic per slug globally — true until
// issue 05 owner-scopes the routine/publish path; multi-owner same-slug needs that.
export const ensureTopic = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), slug: v.string(), title: v.string() },
  handler: async (ctx, { secret, ownerEmail, slug, title }): Promise<Id<"topics">> => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error(`no registered user with email ${ownerEmail} — register first`);

    const existing = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      if (!existing.ownerId) await ctx.db.patch(existing._id, { ownerId: owner._id });
      return existing._id;
    }
    return await ctx.db.insert("topics", { slug, title, ownerId: owner._id });
  },
});

// The Routine's Mission publish (issue 07): on a Seeded Topic's first run it
// drafts the Mission from the Seed + Resources, publishes it here, and flips
// `seeded` → `active`. Operator path (no auth), so owner is named by email.
export const publishMission = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string(), mission: v.string() },
  handler: async (ctx, { secret, ownerEmail, topicSlug, mission }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error(`no registered user with email ${ownerEmail}`);
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { mission, status: "active" });
  },
});

// Lessons are immutable: insert if absent, otherwise no-op. If `supersedes` is
// given, the named prior lesson is retired (its `supersededBy` points here).
export const publishLesson = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    title: v.string(),
    html: v.string(),
    supersedes: v.optional(v.string()),
  },
  handler: async (ctx, { secret, topicId, key, seq, title, html, supersedes }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) return { status: "exists" as const };

    await ctx.db.insert("lessons", { topicId, key, seq, title, html });
    if (supersedes) {
      const old = await ctx.db
        .query("lessons")
        .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", supersedes))
        .unique();
      if (old) await ctx.db.patch(old._id, { supersededBy: key });
    }
    return { status: "inserted" as const };
  },
});

// Learning records are append-only history: insert if absent, otherwise no-op
// (like Lessons). The Routine writes one per authored Lesson; they ground the
// next run's ZPD decision and are pulled back at materialise.
export const publishLearningRecord = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    markdown: v.string(),
  },
  handler: async (ctx, { secret, topicId, key, seq, markdown }) => {
    assertAdmin(secret);
    const existing = await ctx.db
      .query("learningRecords")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) return { status: "exists" as const };
    await ctx.db.insert("learningRecords", { topicId, key, seq, markdown });
    return { status: "inserted" as const };
  },
});

// References are mutable: upsert, skipping unchanged content (by hash).
export const upsertReference = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    title: v.string(),
    html: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, { secret, topicId, key, title, html, contentHash }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) {
      if (existing.contentHash === contentHash) return { status: "unchanged" as const };
      await ctx.db.patch(existing._id, { title, html, contentHash });
      return { status: "updated" as const };
    }
    await ctx.db.insert("references", { topicId, key, title, html, contentHash });
    return { status: "inserted" as const };
  },
});
