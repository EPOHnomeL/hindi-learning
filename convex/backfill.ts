import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { topicBySlug } from "./topicAccess";
import { assertAdmin } from "./adminSecret";
import { shuffleQuizOptions } from "./quizShuffle";
import { quizStructureMatches } from "./translate";

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
      // Lesson bodies now live in content blobs (no inline `html`), so only the
      // still-inline `translations` rows are shufflable in-row here.
      if (!("html" in row)) continue;
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

// Integrity check before dropping inline `html` (issue 05). Read-only: for each
// body row it confirms a blob exists AND its bytes equal the inline `html`, so
// we can prove `html` is redundant before removing it. `stranded` (inline html
// but no blob) and `mismatched` (blob != html) must both be 0 to narrow safely.
export const verifyHtmlBlobs = action({
  args: { secret: v.string(), table: blobTableV, cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    bodies: v.number(),
    matched: v.number(),
    mismatched: v.number(),
    stranded: v.number(),
    blobOnly: v.number(),
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    { secret, table, cursor },
  ): Promise<{ bodies: number; matched: number; mismatched: number; stranded: number; blobOnly: number; isDone: boolean; cursor: string | null }> => {
    assertAdmin(secret);
    const page: { isDone: boolean; cursor: string | null; rows: Array<{ id: string; html?: string; htmlStorageId?: Id<"_storage">; kind?: string }> } =
      await ctx.runQuery(internal.backfill.pageToBackfill, { table, cursor });
    let bodies = 0,
      matched = 0,
      mismatched = 0,
      stranded = 0,
      blobOnly = 0;
    for (const r of page.rows) {
      if (table === "translations" && r.kind !== "lesson" && r.kind !== "reference") continue;
      if (r.html == null && !r.htmlStorageId) continue; // no body at all
      bodies++;
      if (!r.htmlStorageId) {
        stranded++; // inline html but no blob — dropping html WOULD lose this
        continue;
      }
      if (r.html == null) {
        blobOnly++; // already narrowed (blob, no inline) — fine
        continue;
      }
      const blob = await ctx.storage.get(r.htmlStorageId);
      const text = blob ? await blob.text() : null;
      if (text === r.html) matched++;
      else mismatched++; // blob missing or bytes differ from inline html
    }
    return { bodies, matched, mismatched, stranded, blobOnly, isDone: page.isDone, cursor: page.cursor };
  },
});

// `stripInlineHtml` (the pre-narrow data-strip, PR #9) is intentionally gone from
// here: once `lessons`/`references` no longer carry inline `html`, it can't
// compile and its job (strip prod rows before this narrow deploys) is complete.

// ---- generation-observability issue 03: seed run history from lessons -------
//
// One-shot backfill so the Generation Run history isn't empty on launch: insert a
// synthetic `published` run per existing Lesson (ALL lessons, incl. superseded —
// each was a real past authoring event), stamping the Lesson's creation time as
// both `startedAt` and `endedAt` (the true start is unknown) and its key/title as
// the produced Lesson. Run once per deployment via `npx convex run
// backfill:backfillGenerationRuns`. Idempotent by design: it no-ops if any run row
// already exists, so it only ever runs against a fresh log and never races the
// real going-forward rows recordRun writes. Lesson counts are curriculum-sized, so
// a single unpaginated pass is fine.
export const backfillGenerationRuns = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("generationRuns").first();
    if (existing) return { inserted: 0 };
    const lessons = await ctx.db.query("lessons").collect();
    for (const l of lessons) {
      await ctx.db.insert("generationRuns", {
        topicId: l.topicId,
        outcome: "published",
        startedAt: l._creationTime,
        endedAt: l._creationTime,
        producedLessonKey: l.key,
        producedLessonTitle: l.title,
      });
    }
    return { inserted: lessons.length };
  },
});

// ---- One-off wording sweep across a Topic's source Lessons ------------------
//
// Replace a literal string in every non-superseded source Lesson body of ONE
// Topic — the bulk twin of the owner's hover-pencil edit, for a wording change
// that would otherwise mean opening every lesson by hand (the first use:
// "Vehicle:" → "Scripture:" in the header pill of a Bible course, which the
// authoring template had wrong; the template is fixed for future lessons, this
// fixes the ones already published).
//
// Deliberately literal, not a regex: the caller names exact bytes, so there is no
// pattern to get wrong across dozens of live lessons. `quizStructureMatches`
// guards each body the same way the owner's edit path does, so a replacement that
// somehow disturbed a quiz marker is refused per-lesson rather than shipped —
// scoring is positional. `dryRun` reports what WOULD change and writes nothing;
// run it first.
//
// Secret-gated (PUBLISH_SECRET), like the teach CLI's publish seams that already
// write arbitrary Lesson bodies. Idempotent: once `from` is gone, a re-run is a
// no-op. Driver: `pnpm run sweep-lesson-text[:prod]`.
//
// NOTE for the caller: patching a source body changes the Lesson's
// `htmlStorageId`, which is the staleness key `itemHash` uses — so every
// translated Edition row for a swept lesson goes stale and a later re-translate
// will regenerate it (overwriting a manual translation edit of that lesson). That
// is true of the owner's own in-place edit too; it is not new here.
export const sweepLessonText = action({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    from: v.string(),
    to: v.string(),
    dryRun: v.boolean(),
  },
  returns: v.object({
    scanned: v.number(),
    changed: v.array(v.object({ key: v.string(), hits: v.number() })),
    refused: v.array(v.string()),
  }),
  handler: async (
    ctx,
    { secret, topicSlug, from, to, dryRun },
  ): Promise<{ scanned: number; changed: Array<{ key: string; hits: number }>; refused: string[] }> => {
    assertAdmin(secret);
    if (!from) throw new Error("`from` must not be empty");
    const rows: Array<{ id: Id<"lessons">; key: string; storageId: Id<"_storage"> }> = await ctx.runQuery(
      internal.backfill.sweepableLessons,
      { topicSlug },
    );
    const changed: Array<{ key: string; hits: number }> = [];
    const refused: string[] = [];
    for (const r of rows) {
      const blob = await ctx.storage.get(r.storageId);
      const html = blob ? await blob.text() : null;
      // An unreadable body is reported, never rewritten from nothing.
      if (html === null) {
        refused.push(r.key);
        continue;
      }
      const hits = html.split(from).length - 1;
      if (hits === 0) continue;
      const next = html.split(from).join(to);
      if (!quizStructureMatches(html, next)) {
        refused.push(r.key);
        continue;
      }
      changed.push({ key: r.key, hits });
      if (dryRun) continue;
      const storageId = await ctx.storage.store(new Blob([next], { type: "text/html" }));
      await ctx.runMutation(internal.backfill.swapLessonBody, { id: r.id, storageId, old: r.storageId });
    }
    return { scanned: rows.length, changed, refused };
  },
});

// The Lessons a sweep may touch: one Topic's live (non-superseded) bodies. A
// curriculum is tens of rows, so one pass is fine.
export const sweepableLessons = internalQuery({
  args: { topicSlug: v.string() },
  returns: v.array(v.object({ id: v.id("lessons"), key: v.string(), storageId: v.id("_storage") })),
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error(`no topic ${topicSlug}`);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id))
      .collect();
    return lessons
      .filter((l) => !l.supersededBy && l.htmlStorageId)
      .map((l) => ({ id: l._id, key: l.key, storageId: l.htmlStorageId! }));
  },
});

// Point a Lesson at its rewritten body and delete the one it replaces (no orphan
// — same discipline as `applyLessonEdit`).
export const swapLessonBody = internalMutation({
  args: { id: v.id("lessons"), storageId: v.id("_storage"), old: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { id, storageId, old }) => {
    await ctx.db.patch(id, { htmlStorageId: storageId });
    if (old !== storageId) await ctx.storage.delete(old);
    return null;
  },
});

// ---- Ledger `kind` backfill (ADR 0027) --------------------------------------
//
// Stamp `kind: "sale"` onto every Ledger row written before the donation rail
// existed. Every row predating ADR 0027 IS a sale — donations postdate the
// field — so this is a pure labelling pass, not a reclassification.
//
// Why it matters even though the readers already cope: `sales.salesOnly` reads
// "not a donation" precisely BECAUSE legacy rows carry no `kind`, and
// `ledger.owedPayouts` defaults an absent `kind` to "sale" for the same reason.
// Once this has run everywhere, `kind` can be narrowed to required in the
// schema and both readers can test `=== "sale"` — which is what makes a future
// THIRD money kind safe (an allow-list, not a deny-list).
//
// Idempotent: a row that already carries a `kind` is skipped, so re-running is a
// no-op. Paginated with the cursor threaded by the driver
// `pnpm run backfill-ledger-kind[:prod]`.
export const backfillLedgerKind = mutation({
  args: { secret: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ patched: v.number(), isDone: v.boolean(), cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, { secret, cursor }) => {
    assertAdmin(secret);
    const page = await ctx.db.query("ledger").paginate({ cursor, numItems: 100 });
    let patched = 0;
    for (const row of page.page) {
      if (row.kind !== undefined) continue;
      await ctx.db.patch(row._id, { kind: "sale" });
      patched++;
    }
    return { patched, isDone: page.isDone, cursor: page.continueCursor };
  },
});
