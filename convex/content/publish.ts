import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getOwnedTopic, topicBySlug } from "../topicAccess";
import { assertAdmin } from "../adminSecret";
import { assertEmblemImage, normaliseGlyph } from "../emblem";

// ---- Publish (teach CLI, PUBLISH_SECRET-guarded) ---------------------------

// Mint an upload URL for a content blob (a Lesson / Reference body). The teach
// CLI `PUT`s the HTML straight to storage and passes the resulting storageId to
// the publish mutations, so the HTML never rides through a Convex function (see
// .scratch/html-blob-storage). Secret-guarded like the other teach seams.
export const generateContentUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, { secret }) => {
    assertAdmin(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

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

// The teach skill's termination call (ADR 0015): when the Mission's "Success
// looks like" outcomes are substantially met (see SKILL.md "Terminating a
// course"), the run marks the Topic `completed` so the Routine's gate stops
// authoring. Secret-guarded like the other teach write-backs; resolves by slug
// (the run knows its Topic's slug), the twin of the owner's `endCourse`.
//
// The teach skill also supplies the default Emblem here (ADR 0017): an
// already-uploaded image reference (via `generateProcessedUploadUrl`) and/or a
// fallback glyph, normalised + uploaded skill-side. It is applied only when the
// owner has not set their own (`ownerSet`) — so the fixed precedence (owner
// override → AI image → AI glyph → generic default) holds regardless of which
// path wrote first. An owner-ended course (no model in the loop) supplies none
// and falls back to the generic default at read.
export const completeCourse = mutation({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    emblem: v.optional(
      v.object({
        storageId: v.optional(v.id("_storage")),
        contentType: v.optional(v.string()),
        glyph: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { secret, topicSlug, emblem }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { status: "completed" });

    // The AI default never overwrites an owner override. Validate the image the
    // same way the owner path does (raster, size-capped) — both feed the anonymous
    // page. The AI emblem carries no `ownerSet`, so a later owner override still
    // wins.
    if (emblem && !topic.emblem?.ownerSet) {
      const next: { imageId?: Id<"_storage">; glyph?: string } = {};
      if (emblem.storageId) {
        await assertEmblemImage(ctx, emblem.storageId, emblem.contentType ?? "");
        next.imageId = emblem.storageId;
      }
      if (emblem.glyph) next.glyph = normaliseGlyph(emblem.glyph);
      if (next.imageId || next.glyph) await ctx.db.patch(topic._id, { emblem: next });
    }
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
    // The body is uploaded to storage by the CLI first (generateContentUploadUrl)
    // and passed as a blob id — the HTML never rides through this function.
    storageId: v.id("_storage"),
    supersedes: v.optional(v.string()),
  },
  handler: async (ctx, { secret, topicId, key, seq, title, storageId, supersedes }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    // Lessons are immutable: the freshly-uploaded blob is redundant, so drop it
    // (mirrors resources' dedupe-delete) rather than orphan it in storage.
    if (existing) {
      await ctx.storage.delete(storageId);
      return { status: "exists" as const };
    }

    await ctx.db.insert("lessons", { topicId, key, seq, title, htmlStorageId: storageId });
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
    storageId: v.id("_storage"),
    contentHash: v.string(),
  },
  handler: async (ctx, { secret, topicId, key, title, storageId, contentHash }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) {
      // Unchanged content → the new upload is redundant; drop it.
      if (existing.contentHash === contentHash) {
        await ctx.storage.delete(storageId);
        return { status: "unchanged" as const };
      }
      // Changed → point at the new blob and delete the superseded one (a
      // Reference is mutable, so its old body would otherwise orphan). Clear any
      // legacy inline `html` so the row is blob-only going forward.
      if (existing.htmlStorageId) await ctx.storage.delete(existing.htmlStorageId);
      await ctx.db.patch(existing._id, { title, htmlStorageId: storageId, contentHash });
      return { status: "updated" as const };
    }
    await ctx.db.insert("references", { topicId, key, title, htmlStorageId: storageId, contentHash });
    return { status: "inserted" as const };
  },
});
