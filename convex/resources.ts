import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { assertAdmin, getOwnedTopic } from "./lib";

// Learner-uploaded Resources (PRD §Resources). Standard Convex 3-step upload:
// `generateUploadUrl` → client POSTs the file → `addResource` records the row.
// Only raw storage here; lazy processing into `processed` is issue 06.

// Step 1: a short-lived URL the client POSTs the file to. Auth-gated so only a
// signed-in learner can upload.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) throw new Error("unauthenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 3: record the uploaded blob against the learner's Topic. Dedupe by the
// blob's sha256 (Convex computes it into _storage metadata): a re-upload of the
// same bytes returns the existing row and drops the redundant blob.
export const addResource = mutation({
  args: { topicSlug: v.string(), filename: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { topicSlug, filename, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("upload not found");
    const contentHash = meta.sha256;

    const existing = await ctx.db
      .query("resources")
      .withIndex("by_topic_hash", (q) => q.eq("topicId", topic._id).eq("contentHash", contentHash))
      .unique();
    if (existing) {
      await ctx.storage.delete(storageId); // identical bytes already stored
      return existing._id;
    }

    return await ctx.db.insert("resources", {
      topicId: topic._id,
      ownerId: userId,
      filename,
      rawStorageId: storageId,
      contentHash,
      status: "raw",
      kind: "file",
    });
  },
});

// ---- Lazy ingestion (PUBLISH_SECRET-guarded) -------------------------------

// The agent uploads rendered/extracted artifacts (e.g. PDF page PNGs) through
// this; it has PUBLISH_SECRET, not an auth identity, so it can't use the
// learner-facing generateUploadUrl.
export const generateProcessedUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    assertAdmin(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

// Cache an ingested Resource back: fill `processed` and flip to `ready`, keyed
// by (Topic, contentHash). Idempotent — two runs rendering the same Resource
// converge. A re-uploaded (changed) file is a new row with a new hash and no
// processed, so it naturally re-renders; this never matches the stale one.
export const cacheProcessedResource = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string(), contentHash: v.string(), processed: v.any() },
  handler: async (ctx, { secret, ownerEmail, topicSlug, contentHash, processed }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error("owner not found");
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) throw new Error("topic not found");
    const res = await ctx.db
      .query("resources")
      .withIndex("by_topic_hash", (q) => q.eq("topicId", topic._id).eq("contentHash", contentHash))
      .unique();
    if (!res) throw new Error("no resource for that contentHash");
    await ctx.db.patch(res._id, { processed, status: "ready" });
    return res._id;
  },
});

// The learner's Resources for a Topic (owner+topic scoped).
export const listResources = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("resources")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    return rows.map((r) => ({ id: r._id, filename: r.filename, status: r.status, kind: r.kind }));
  },
});
