import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertAdmin, topicBySlug } from "./lib";

// ---- Legacy course tenant backfill (whitelabel issue 23) --------------------
//
// The Convex side of scripts/tenant-course-backfill.ts. Deliberately thin: the
// palette re-bake (the interesting, testable logic) lives in the script; here we
// only do the storage I/O the script can't (blob get/store is action-only) and
// the one-field tenant assignment. All three functions are PUBLISH_SECRET-guarded
// like the other operator-script writes (seedTenant, backfill actions) — dev has
// operator accounts only, so a real course lives on prod, reached via the `:prod`
// CLI carrying the secret.

const artifactTableV = v.union(v.literal("lessons"), v.literal("references"), v.literal("translations"));
const artifactRefV = v.object({ table: artifactTableV, id: v.string() });

// Assign an existing course to a tenant: the operator twin of tenants.assignCourse
// (that one is identity-guarded for the dashboard; this is secret-guarded for the
// script). Refuses to steal a course already owned by another tenant, matching
// assignCourse. Idempotent for a course already on this tenant.
export const setCourseTenant = mutation({
  args: { secret: v.string(), topicId: v.id("topics"), tenantSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { secret, topicId, tenantSlug }) => {
    assertAdmin(secret);
    const topic = await ctx.db.get(topicId);
    if (!topic) throw new Error("course not found");
    if (topic.tenantSlug && topic.tenantSlug !== tenantSlug) {
      throw new Error("That course belongs to another tenant.");
    }
    await ctx.db.patch(topicId, { tenantSlug });
    return null;
  },
});

// The course's re-bakeable artifacts: every Lesson and Reference, plus the
// translated lesson/reference Editions (they carry the same head.html chrome and
// so need the same re-bake — issue 13 covered all three). Returns only refs (ids),
// not bodies, so the payload stays small; the driver fetches each body separately.
// All reads are `topicId`-prefixed indexed reads (translations' `by_topic_lang`
// used with only the topic eq spans every language). A course's artifact set is
// operator-bounded content, so collecting it is the right read (cf. courseAssignment).
export const courseArtifacts = query({
  args: { secret: v.string(), courseSlug: v.string() },
  returns: v.object({ topicId: v.id("topics"), artifacts: v.array(artifactRefV) }),
  handler: async (ctx, { secret, courseSlug }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, courseSlug);
    if (!topic) throw new Error(`No course with slug "${courseSlug}".`);

    const artifacts: Array<{ table: "lessons" | "references" | "translations"; id: string }> = [];

    for (const l of await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()) {
      artifacts.push({ table: "lessons", id: l._id });
    }
    for (const r of await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()) {
      artifacts.push({ table: "references", id: r._id });
    }
    for (const t of await ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id)).collect()) {
      if (t.kind === "lesson" || t.kind === "reference") artifacts.push({ table: "translations", id: t._id });
    }
    return { topicId: topic._id, artifacts };
  },
});

// One artifact's stored body (blob id + inline html), for the read/write actions.
// Reading blob bytes is action-only, so this only surfaces the storage id; the
// action does the `ctx.storage.get`.
export const artifactRow = internalQuery({
  args: artifactRefV,
  returns: v.object({ htmlStorageId: v.union(v.id("_storage"), v.null()), html: v.union(v.string(), v.null()) }),
  handler: async (ctx, { table, id }) => {
    const row =
      table === "lessons"
        ? await ctx.db.get(id as Id<"lessons">)
        : table === "references"
          ? await ctx.db.get(id as Id<"references">)
          : await ctx.db.get(id as Id<"translations">);
    if (!row) return { htmlStorageId: null, html: null };
    const html = "html" in row ? (row.html ?? null) : null;
    return { htmlStorageId: row.htmlStorageId ?? null, html };
  },
});

// Record a re-baked blob's storage id on the row (mint-new, like backfill). Blobs
// are immutable (ADR 0003), so the re-bake stores a NEW blob and repoints the row;
// the old blob is left for GC. Covers all three tables' `htmlStorageId`.
export const setArtifactBlob = internalMutation({
  args: { table: artifactTableV, id: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { table, id, storageId }) => {
    if (table === "lessons") await ctx.db.patch(id as Id<"lessons">, { htmlStorageId: storageId });
    else if (table === "references") await ctx.db.patch(id as Id<"references">, { htmlStorageId: storageId });
    else await ctx.db.patch(id as Id<"translations">, { htmlStorageId: storageId });
    return null;
  },
});

// Patch a translation's INLINE html in place (the only body kind still stored
// inline — the translation write-path blob migration is a follow-up). Lessons and
// References never reach here: they're always blobs after the narrow step.
export const setTranslationInlineHtml = internalMutation({
  args: { id: v.string(), html: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, html }) => {
    await ctx.db.patch(id as Id<"translations">, { html });
    return null;
  },
});

// Return one artifact's current body text — the bytes from its blob, or its inline
// html (translations), or null when it has neither. The driver bakes it locally.
export const readArtifactHtml = action({
  args: { secret: v.string(), table: artifactTableV, id: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { secret, table, id }): Promise<string | null> => {
    assertAdmin(secret);
    const row: { htmlStorageId: Id<"_storage"> | null; html: string | null } = await ctx.runQuery(
      internal.tenantBackfill.artifactRow,
      { table, id },
    );
    if (row.htmlStorageId) {
      const blob = await ctx.storage.get(row.htmlStorageId);
      return blob ? await blob.text() : null;
    }
    return row.html;
  },
});

// Write a re-baked body back: store a new blob and repoint the row (lessons,
// references, and any translation already on a blob), or patch inline html (a
// translation still stored inline). The driver only calls this for bodies it
// actually re-baked.
export const writeArtifactHtml = action({
  args: { secret: v.string(), table: artifactTableV, id: v.string(), html: v.string() },
  returns: v.null(),
  handler: async (ctx, { secret, table, id, html }): Promise<null> => {
    assertAdmin(secret);
    const row: { htmlStorageId: Id<"_storage"> | null; html: string | null } = await ctx.runQuery(
      internal.tenantBackfill.artifactRow,
      { table, id },
    );
    if (table === "translations" && !row.htmlStorageId) {
      await ctx.runMutation(internal.tenantBackfill.setTranslationInlineHtml, { id, html });
    } else {
      const storageId = await ctx.storage.store(new Blob([html], { type: "text/html" }));
      await ctx.runMutation(internal.tenantBackfill.setArtifactBlob, { table, id, storageId });
    }
    return null;
  },
});
