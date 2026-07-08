/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
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

test("backfillHtmlBlobs moves inline html into a blob and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));
  const lessonId = await t.run((ctx) =>
    ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "One", html: "<p>body</p>" }),
  );

  expect(await runBackfill(t, "lessons")).toBe(1);
  const row = await t.run((ctx) => ctx.db.get(lessonId));
  expect(row?.htmlStorageId).toBeDefined();
  // The blob holds the original body (read text inside t.run — a Blob can't
  // cross the t.run boundary).
  const text = await t.run(async (ctx) => {
    const b = await ctx.storage.get(row!.htmlStorageId as Id<"_storage">);
    return b ? await b.text() : null;
  });
  expect(text).toBe("<p>body</p>");

  // Idempotent: a second pass migrates nothing (row already has htmlStorageId).
  expect(await runBackfill(t, "lessons")).toBe(0);
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
