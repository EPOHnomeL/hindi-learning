import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdmin, getOwnedTopic, getViewableTopic } from "./lib";

// Learner-uploaded Resources (PRD §Resources). Standard Convex 3-step upload:
// `generateUploadUrl` → client POSTs the file → `addResource` records the row.
// Only raw storage here; lazy processing into `processed` is issue 06.

// Shared record step: dedupe by the blob's sha256 (Convex computes it into
// _storage metadata) — a re-upload of the same bytes returns the existing row
// and drops the redundant blob. Used by the learner and operator upload paths.
async function recordUploadedResource(
  ctx: MutationCtx,
  topicId: Id<"topics">,
  ownerId: Id<"users">,
  filename: string,
  storageId: Id<"_storage">,
) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) throw new Error("upload not found");
  const contentHash = meta.sha256;
  const existing = await ctx.db
    .query("resources")
    .withIndex("by_topic_hash", (q) => q.eq("topicId", topicId).eq("contentHash", contentHash))
    .unique();
  if (existing) {
    await ctx.storage.delete(storageId); // identical bytes already stored
    return existing._id;
  }
  return await ctx.db.insert("resources", {
    topicId,
    ownerId,
    filename,
    rawStorageId: storageId,
    contentHash,
    status: "raw",
    kind: "file",
  });
}

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
    return await recordUploadedResource(ctx, topic._id, userId, filename, storageId);
  },
});

// Add an external link Resource (no blob). Deduped by the URL within the Topic.
export const addUrlResource = mutation({
  args: { topicSlug: v.string(), url: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, url, label }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const link = url.trim();
    if (!link) throw new Error("url required");

    const existing = await ctx.db
      .query("resources")
      .withIndex("by_topic_hash", (q) => q.eq("topicId", topic._id).eq("contentHash", link))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("resources", {
      topicId: topic._id,
      ownerId: userId,
      filename: label?.trim() || link,
      url: link,
      contentHash: link,
      status: "raw",
      kind: "url",
    });
  },
});

// Operator upload (PUBLISH_SECRET-guarded): the migration path has no auth, so
// the owner is named by email. Used to move Handbook.pdf into the hindi Topic
// (issue 09). Same dedupe as the learner path.
export const addResourceAdmin = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string(), filename: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { secret, ownerEmail, topicSlug, filename, storageId }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error("owner not found");
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) throw new Error("topic not found");
    return await recordUploadedResource(ctx, topic._id, owner._id, filename, storageId);
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

// Operator inventory (PUBLISH_SECRET-guarded): every Topic + Resource for an
// owner named by email — how the operator finds a Resource to act on
// (remove/inspect) without dashboard access. Mirrors addResourceAdmin's
// owner-by-email resolution.
export const listResourcesAdmin = query({
  args: { secret: v.string(), ownerEmail: v.string() },
  returns: v.array(
    v.object({
      topicSlug: v.string(),
      topicTitle: v.string(),
      resources: v.array(
        v.object({
          id: v.id("resources"),
          filename: v.string(),
          kind: v.union(v.literal("file"), v.literal("url")),
          status: v.union(v.literal("raw"), v.literal("processing"), v.literal("ready")),
          url: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { secret, ownerEmail }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error("owner not found");
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
      .collect();
    return await Promise.all(
      topics.map(async (topic) => ({
        topicSlug: topic.slug,
        topicTitle: topic.title,
        resources: await Promise.all(
          (
            await ctx.db.query("resources").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
          ).map(async (r) => ({
            id: r._id,
            filename: r.filename,
            kind: r.kind,
            status: r.status,
            // the openable link — the external URL, or a signed blob URL so the
            // operator can back a file up before removing it
            url: r.kind === "url" ? (r.url ?? null) : r.rawStorageId ? await ctx.storage.getUrl(r.rawStorageId) : null,
          })),
        ),
      })),
    );
  },
});

// Walk an opaque `processed` manifest for anything that is a _storage id, so a
// removal can also delete the rendered artifacts (page PNGs etc.) it references.
function collectStorageIds(ctx: MutationCtx, value: unknown, into: Set<Id<"_storage">>): void {
  if (typeof value === "string") {
    const id = ctx.db.system.normalizeId("_storage", value);
    if (id) into.add(id);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStorageIds(ctx, item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStorageIds(ctx, item, into);
  }
}

// Operator removal (PUBLISH_SECRET-guarded): hard-delete a Resource — the row,
// its raw blob, and every artifact blob its processed manifest references.
// Deleting the blobs is the point: storage URLs are permanent bearer links, so
// a row-only delete would leave the file fetchable by anyone who kept the URL.
export const removeResourceAdmin = mutation({
  args: { secret: v.string(), resourceId: v.id("resources") },
  returns: v.object({
    filename: v.string(),
    kind: v.union(v.literal("file"), v.literal("url")),
    blobsDeleted: v.number(),
  }),
  handler: async (ctx, { secret, resourceId }) => {
    assertAdmin(secret);
    const res = await ctx.db.get(resourceId);
    if (!res) throw new Error("resource not found");
    const blobs = new Set<Id<"_storage">>();
    if (res.rawStorageId) blobs.add(res.rawStorageId);
    collectStorageIds(ctx, res.processed, blobs);
    let blobsDeleted = 0;
    for (const id of blobs) {
      if (await ctx.db.system.get(id)) {
        await ctx.storage.delete(id);
        blobsDeleted++;
      }
    }
    await ctx.db.delete(resourceId);
    return { filename: res.filename, kind: res.kind, blobsDeleted };
  },
});

// The Topic's Resources, for the owner or a read-only Viewer. Owner-or-Viewer
// gated so a Viewer sees the list and gets working open/signed links (PRD story
// 15); adding/recording Resources stays owner-only.
export const listResources = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("resources")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    // `url` is what the sidebar opens: the external link, or a signed URL for
    // the stored blob.
    return await Promise.all(
      rows.map(async (r) => ({
        id: r._id,
        filename: r.filename,
        status: r.status,
        kind: r.kind,
        url: r.kind === "url" ? (r.url ?? null) : r.rawStorageId ? await ctx.storage.getUrl(r.rawStorageId) : null,
      })),
    );
  },
});
