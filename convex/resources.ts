import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getOwnedTopic } from "./lib";

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
