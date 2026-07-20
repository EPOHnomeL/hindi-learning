/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

const secret = "test-secret";

async function runBackfill(t: ReturnType<typeof convexTest>, table: "lessons" | "references" | "translations") {
  let cursor: string | null = null;
  let patched = 0;
  for (;;) {
    const res = await t.action(api.backfill.backfillHtmlBlobs, { secret, table, cursor });
    patched += res.patched;
    if (res.isDone) break;
    cursor = res.cursor;
  }
  return patched;
}

// Lessons/References no longer carry inline `html` (narrowed), so the only table
// still holding inline bodies to migrate is `translations` — exercise the
// backfill there.
test("backfillHtmlBlobs moves inline html into a blob and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));
  const rowId = await t.run((ctx) =>
    ctx.db.insert("translations", { topicId, lang: "es", kind: "lesson", key: "0001", html: "<p>body</p>", sourceHash: "h" }),
  );

  expect(await runBackfill(t, "translations")).toBe(1);
  const row = await t.run((ctx) => ctx.db.get(rowId));
  expect(row?.htmlStorageId).toBeDefined();
  // The blob holds the original body (read text inside t.run — a Blob can't
  // cross the t.run boundary).
  const text = await t.run(async (ctx) => {
    const b = await ctx.storage.get(row!.htmlStorageId as Id<"_storage">);
    return b ? await b.text() : null;
  });
  expect(text).toBe("<p>body</p>");

  // Idempotent: a second pass migrates nothing (row already has htmlStorageId).
  expect(await runBackfill(t, "translations")).toBe(0);
});

test("backfillHtmlBlobs migrates only lesson/reference translation rows, skips others", async () => {
  const t = convexTest(schema, modules);
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));
  await t.run(async (ctx) => {
    await ctx.db.insert("translations", { topicId, lang: "es", kind: "lesson", key: "0001", html: "<p>es</p>", sourceHash: "h" });
    // A title-kind row has no html body — must be skipped.
    await ctx.db.insert("translations", { topicId, lang: "es", kind: "title", key: "", text: "Título", sourceHash: "h" });
  });

  expect(await runBackfill(t, "translations")).toBe(1);
  const rows = await t.run((ctx) => ctx.db.query("translations").collect());
  const lesson = rows.find((r) => r.kind === "lesson");
  const title = rows.find((r) => r.kind === "title");
  expect(lesson?.htmlStorageId).toBeDefined();
  expect(title?.htmlStorageId).toBeUndefined();
});

test("backfillHtmlBlobs rejects a bad secret", async () => {
  const t = convexTest(schema, modules);
  await expect(t.action(api.backfill.backfillHtmlBlobs, { secret: "wrong", table: "lessons", cursor: null })).rejects.toThrow();
});

// ---- generation-observability issue 03: backfill runs from lessons ----------

test("backfillGenerationRuns seeds one published run per lesson (superseded included)", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const hindi = await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi" }));
  const greek = await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Greek" }));
  const l1 = await t.run((ctx) => ctx.db.insert("lessons", { topicId: hindi, key: "0001", seq: 1, title: "One" }));
  // A superseded lesson is still a real past authoring event — it must appear.
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: hindi, key: "0000", seq: 0, title: "Old", supersededBy: "0001" }));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: greek, key: "0001", seq: 1, title: "Alpha" }));

  const res = await t.mutation(internal.backfill.backfillGenerationRuns, {});
  expect(res).toEqual({ inserted: 3 });

  const runs = await t.run((ctx) => ctx.db.query("generationRuns").collect());
  expect(runs).toHaveLength(3);
  expect(runs.every((r) => r.outcome === "published")).toBe(true);
  // endedAt mirrors the lesson's creation time.
  const l1Doc = await t.run((ctx) => ctx.db.get(l1));
  const l1Run = runs.find((r) => r.producedLessonKey === "0001" && r.topicId === hindi);
  expect(l1Run).toMatchObject({ producedLessonTitle: "One", endedAt: l1Doc!._creationTime, startedAt: l1Doc!._creationTime });
});

test("backfillGenerationRuns is idempotent — a re-run inserts nothing", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const hindi = await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi" }));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: hindi, key: "0001", seq: 1, title: "One" }));

  expect(await t.mutation(internal.backfill.backfillGenerationRuns, {})).toEqual({ inserted: 1 });
  expect(await t.mutation(internal.backfill.backfillGenerationRuns, {})).toEqual({ inserted: 0 });
  expect(await t.run((ctx) => ctx.db.query("generationRuns").collect())).toHaveLength(1);
});
