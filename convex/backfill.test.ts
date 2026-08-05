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

// ---- sweepLessonText: bulk wording fix across a Topic's source Lessons -------

const PILL = (label: string) => `<span class="pill">${label}: John 16:13</span>`;
// A body with a quiz, so the structure guard has markers to compare.
const QUIZ = '<div class="quiz" data-correct="b"><button class="opt" data-k="a">x</button><button class="opt" data-k="b">y</button></div>';

async function seedSweepable(t: ReturnType<typeof convexTest>) {
  const owner = await t.run((ctx) => ctx.db.insert("users", { email: "owner@example.com" }));
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "prophetic", title: "Prophetic" }));
  const other = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi" }));
  const store = (html: string) => t.run((ctx) => ctx.storage.store(new Blob([html], { type: "text/html" })));
  const sids = {
    l1: await store(PILL("Vehicle") + QUIZ),
    l2: await store(PILL("Vehicle") + "<p>Vehicle: also here</p>" + QUIZ),
    l3: await store(PILL("Scripture") + QUIZ), // already correct — untouched
    old: await store(PILL("Vehicle") + QUIZ), // superseded — not served, not swept
    other: await store(PILL("Vehicle") + QUIZ), // a different Topic — never touched
  };
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0000", seq: 0, title: "Old", htmlStorageId: sids.old, supersededBy: "0001" });
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "One", htmlStorageId: sids.l1 });
    await ctx.db.insert("lessons", { topicId, key: "0002", seq: 2, title: "Two", htmlStorageId: sids.l2 });
    await ctx.db.insert("lessons", { topicId, key: "0003", seq: 3, title: "Three", htmlStorageId: sids.l3 });
    await ctx.db.insert("lessons", { topicId: other, key: "0001", seq: 1, title: "Hindi one", htmlStorageId: sids.other });
  });
  return { topicId, sids };
}

const bodyOf = (t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string) =>
  t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    const blob = lesson?.htmlStorageId ? await ctx.storage.get(lesson.htmlStorageId) : null;
    return blob ? await blob.text() : null;
  });

const SWEEP = { secret, topicSlug: "prophetic", from: "Vehicle:", to: "Scripture:" };

test("sweepLessonText: a dry run reports every hit and writes nothing", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedSweepable(t);

  const res = await t.action(api.backfill.sweepLessonText, { ...SWEEP, dryRun: true });
  // Superseded and already-correct lessons are scanned but not counted as changed.
  expect(res.scanned).toBe(3);
  expect(res.changed).toEqual([
    { key: "0001", hits: 1 },
    { key: "0002", hits: 2 },
  ]);
  expect(res.refused).toEqual([]);
  expect(await bodyOf(t, topicId, "0001")).toContain("Vehicle:");
});

test("sweepLessonText: --apply rewrites the live bodies, deletes the old blobs, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const { topicId, sids } = await seedSweepable(t);

  const res = await t.action(api.backfill.sweepLessonText, { ...SWEEP, dryRun: false });
  expect(res.changed.map((c) => c.key)).toEqual(["0001", "0002"]);

  expect(await bodyOf(t, topicId, "0001")).toBe(PILL("Scripture") + QUIZ);
  expect(await bodyOf(t, topicId, "0002")).toBe(PILL("Scripture") + "<p>Scripture: also here</p>" + QUIZ);
  // Untouched: the already-correct lesson keeps its original blob id.
  expect(await t.run(async (ctx) => (await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0003")).unique())?.htmlStorageId)).toBe(sids.l3);
  // No orphan: the replaced body is gone from storage.
  expect(await t.run((ctx) => ctx.storage.getUrl(sids.l1))).toBeNull();
  // The superseded lesson and the other Topic's lesson still read the old way.
  expect(await t.run((ctx) => ctx.storage.getUrl(sids.old))).not.toBeNull();
  expect(await bodyOf(t, topicId, "0000")).toContain("Vehicle:");

  // Idempotent: nothing left to find.
  expect((await t.action(api.backfill.sweepLessonText, { ...SWEEP, dryRun: false })).changed).toEqual([]);
});

test("sweepLessonText: refuses a swap that would disturb a quiz marker, and a bad secret", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedSweepable(t);

  // Dropping an option's data-k changes the marker COUNT, which positional
  // scoring depends on — refuse rather than ship a mis-scored quiz.
  const res = await t.action(api.backfill.sweepLessonText, {
    secret,
    topicSlug: "prophetic",
    from: '<button class="opt" data-k="b">y</button>',
    to: '<button class="opt">y</button>',
    dryRun: false,
  });
  expect(res.changed).toEqual([]);
  expect(res.refused.sort()).toEqual(["0001", "0002", "0003"]);
  expect(await bodyOf(t, topicId, "0001")).toContain('<button class="opt" data-k="b">y</button>');

  await expect(t.action(api.backfill.sweepLessonText, { ...SWEEP, secret: "wrong", dryRun: true })).rejects.toThrow();
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
