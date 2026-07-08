import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertAdmin } from "./lib";
import { shuffleQuizOptions } from "./quizShuffle";

// One-shot, secret-gated backfill: reshuffle the option order of every stored
// quiz so the correct answer is no longer clustered at the first position (the
// authoring model's tell). Covers the source lessons AND every translated
// lesson Edition (translations of kind "lesson"). `shuffleQuizOptions` is
// deterministic and idempotent, so re-running this is safe and a no-op once
// applied. Future lessons are shuffled at publish time (scripts/publish.ts) and
// future translations inherit the shuffled source, so this only fixes existing
// rows.
//
// Paginated a page at a time (the translations table grows with Editions), with
// the cursor threaded by the driver `pnpm run backfill-quiz-shuffle[:prod]`.
export const backfillQuizShuffle = mutation({
  args: {
    secret: v.string(),
    table: v.union(v.literal("lessons"), v.literal("translations")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ patched: v.number(), isDone: v.boolean(), cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, { secret, table, cursor }) => {
    assertAdmin(secret);

    const page = await ctx.db.query(table).paginate({ cursor, numItems: 100 });
    let patched = 0;
    for (const row of page.page) {
      // translations covers every artifact kind; only lesson bodies carry quizzes.
      if ("kind" in row && row.kind !== "lesson") continue;
      const html = row.html;
      if (html === undefined) continue;
      const shuffled = shuffleQuizOptions(html);
      if (shuffled !== html) {
        await ctx.db.patch(row._id, { html: shuffled });
        patched++;
      }
    }
    return { patched, isDone: page.isDone, cursor: page.continueCursor };
  },
});

// ---- HTML → content-blob backfill (.scratch/html-blob-storage, issue 04) ----
//
// Moves every existing inline `html` body (Lessons, References, and translated
// lesson/reference rows) into a Convex File Storage blob and records
// `htmlStorageId`. `ctx.storage.store` is action-only, so the driver is an
// ACTION that pages via an internal query and patches via an internal mutation.
// Idempotent: a row that already has `htmlStorageId` is skipped, so re-running
// is a safe no-op. Inline `html` is LEFT in place (the read path prefers the
// blob); it's dropped later in the narrow step (issue 05).

const blobTableV = v.union(v.literal("lessons"), v.literal("references"), v.literal("translations"));

export const pageToBackfill = internalQuery({
  args: { table: blobTableV, cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
    rows: v.array(
      v.object({
        id: v.string(),
        html: v.optional(v.string()),
        htmlStorageId: v.optional(v.id("_storage")),
        kind: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, { table, cursor }) => {
    const page = await ctx.db.query(table).paginate({ cursor, numItems: 50 });
    return {
      isDone: page.isDone,
      cursor: page.continueCursor,
      rows: page.page.map((r) => ({
        id: r._id as string,
        html: "html" in r ? r.html : undefined,
        htmlStorageId: "htmlStorageId" in r ? r.htmlStorageId : undefined,
        kind: "kind" in r ? r.kind : undefined,
      })),
    };
  },
});

export const setHtmlStorageId = internalMutation({
  args: { table: blobTableV, id: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { table, id, storageId }) => {
    // `htmlStorageId` exists on all three tables; the cast just picks one so
    // patch typechecks — the runtime patch is identical regardless.
    if (table === "lessons") await ctx.db.patch(id as Id<"lessons">, { htmlStorageId: storageId });
    else if (table === "references") await ctx.db.patch(id as Id<"references">, { htmlStorageId: storageId });
    else await ctx.db.patch(id as Id<"translations">, { htmlStorageId: storageId });
    return null;
  },
});

export const backfillHtmlBlobs = action({
  args: { secret: v.string(), table: blobTableV, cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    patched: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }),
  // Explicit return type: this action references `internal.backfill.*` from its
  // own module, so TS needs the annotation to avoid a circular-inference cascade.
  handler: async (ctx, { secret, table, cursor }): Promise<{ patched: number; scanned: number; isDone: boolean; cursor: string | null }> => {
    assertAdmin(secret);
    const page: { isDone: boolean; cursor: string | null; rows: Array<{ id: string; html?: string; htmlStorageId?: Id<"_storage">; kind?: string }> } =
      await ctx.runQuery(internal.backfill.pageToBackfill, { table, cursor });
    let patched = 0;
    for (const r of page.rows) {
      if (r.htmlStorageId) continue; // already migrated — idempotent
      // translations covers every artifact kind; only lesson/reference bodies
      // carry the html we're moving.
      if (table === "translations" && r.kind !== "lesson" && r.kind !== "reference") continue;
      if (r.html == null) continue; // nothing to move
      const storageId = await ctx.storage.store(new Blob([r.html], { type: "text/html" }));
      await ctx.runMutation(internal.backfill.setHtmlStorageId, { table, id: r.id, storageId });
      patched++;
    }
    return { patched, scanned: page.rows.length, isDone: page.isDone, cursor: page.cursor };
  },
});
