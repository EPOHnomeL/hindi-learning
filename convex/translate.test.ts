/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { buildTranslateMessages, itemHash, swapBackStatic, swapOutStatic } from "./translate";
import type { Id } from "./_generated/dataModel";

// The translate Routine's publish seams are PUBLISH_SECRET-guarded (assertAdmin).
beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
  // shareTopic → scheduleInvite → appUrl now requires SITE_URL (issue 12).
  process.env.SITE_URL = "https://app.example.com";
});

// Course translation (Editions). An Edition = (Topic, language) is the unit of
// access: the owner holds English + every ready translation; a Viewer holds only
// the languages shared to them; a Guest holds the token's Edition. The reader
// serves translated content when the caller holds the requested language, and
// falls back to the English source per item otherwise. Tested at the Convex seam
// — the actual Claude call (translateItem) is out of band, so these seed
// `translations` rows directly to stand in for a completed translation.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(
  t: ReturnType<typeof convexTest>,
  ownerId: Id<"users">,
  slug: string,
  title: string,
  status: "active" | "completed" = "completed",
) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status }));
}
// Source Lessons are blob-backed (no inline `html`); return the storageId so a
// caller can assert the English body is served as a `/content` URL.
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number): Promise<Id<"_storage">> {
  const sid = await t.run((ctx) => ctx.storage.store(new Blob([`<p>en ${key}</p>`], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, htmlStorageId: sid }));
  return sid;
}
// Stand in for a completed translation of one item.
async function addTranslation(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  lang: string,
  kind: "lesson" | "reference" | "mission" | "title" | "question",
  key: string,
  fields: { title?: string; html?: string; text?: string; reply?: string },
) {
  await t.run((ctx) => ctx.db.insert("translations", { topicId, lang, kind, key, sourceHash: "h", ...fields }));
}
async function addReadyJob(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 }),
  );
}
async function share(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, viewerId: Id<"users">, lang?: string) {
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId, lang }));
}

// ---- Reader: Edition gating + per-item fallback ----------------------------

test("owner reads a translated Edition; unheld languages fall back to English", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  const sid = await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección 0001", html: "<p>es 0001</p>" });

  const a = asUser(t, alice);
  // Spanish edition (the owner holds it — a ready job exists). The translated body
  // is still inline `html` (the translation write-path isn't blob-backed yet).
  expect(await a.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "es" })).toMatchObject({
    title: "Lección 0001",
    html: "<p>es 0001</p>",
  });
  expect(await a.query(api.content.reader.listLessons, { topicSlug: "hindi", lang: "es" })).toEqual([
    // `locked` is the server's paygate verdict (architecture-deepening/03); this
    // Edition is free, so nothing is withheld.
    { key: "0001", seq: 1, title: "Lección 0001", locked: false },
  ]);
  // English (source) is always available; its blob body is served as a content URL.
  expect(await a.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "en" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${sid}`),
  });
  // A language with no Edition (fr) isn't held → falls back to English, never 403s.
  expect(await a.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "fr" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${sid}`),
  });
});

test("a per-item missing translation falls back to the English source", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  const sid2 = await addLesson(t, topicId, "0002", 2);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección 0001", html: "<p>es 0001</p>" });
  // 0002 has no Spanish row → English fallback (the source blob's content URL).
  expect(await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0002", lang: "es" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${sid2}`),
  });
});

test("courseHeader exposes only the Editions the caller holds", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addReadyJob(t, topicId, "ur");

  // Owner holds English + every ready translation.
  const ownerHdr = await asUser(t, alice).query(api.content.reader.courseHeader, { topicSlug: "hindi" });
  expect(ownerHdr!.editions.map((e) => e.lang).sort()).toEqual(["en", "es", "ur"]);

  // A Viewer shared only Urdu holds ONLY Urdu — and Urdu is RTL.
  await share(t, topicId, bob, "ur");
  const bobHdr = await asUser(t, bob).query(api.content.reader.courseHeader, { topicSlug: "hindi", lang: "ur" });
  expect(bobHdr!.editions.map((e) => e.lang)).toEqual(["ur"]);
  expect(bobHdr!.lang).toBe("ur");
  expect(bobHdr!.dir).toBe("rtl");
  // Bob asking for Spanish (not shared to him) can't self-serve it — he gets the
  // only Edition he holds, Urdu.
  const bobEn = await asUser(t, bob).query(api.content.reader.courseHeader, { topicSlug: "hindi", lang: "es" });
  expect(bobEn!.lang).toBe("ur");
});

test("courseHeader carries the served edition's mission — translated, falling back to the source", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.patch(topicId, { mission: "Read the Hindi Bible." }));
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "mission", "", { text: "Lee la Biblia hindi." });

  const a = asUser(t, alice);
  expect((await a.query(api.content.reader.courseHeader, { topicSlug: "hindi", lang: "es" }))?.mission).toBe("Lee la Biblia hindi.");
  expect((await a.query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.mission).toBe("Read the Hindi Bible.");

  // A mission-less course carries null.
  const bare = await seedTopic(t, alice, "bare", "Bare");
  void bare;
  expect((await a.query(api.content.reader.courseHeader, { topicSlug: "bare" }))?.mission).toBeNull();
});

// ---- tryAcquireTranslation: the gate + lock that fires the run --------------
// (startTranslation is a thin action: acquire, then schedule the Gemini translate
// action — ALL translation runs on Gemini now, never the claude.ai routine. The
// gate holds all the db logic and is tested directly, mirroring
// routine.tryAcquireGeneration; the fire branch is covered in
// translate-openrouter.test.ts.)

test("tryAcquireTranslation gates on owner + completed + known language, and seeds the job", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const activeId = await seedTopic(t, alice, "active-course", "Active", "active");
  await addLesson(t, activeId, "0001", 1);

  // Not completed → refused.
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "active-course", lang: "es" }),
  ).toMatchObject({ acquired: false, reason: "not-completed" });

  const doneId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, doneId, "0001", 1);
  // A non-owner can't translate someone else's course.
  expect(
    await asUser(t, bob).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).toMatchObject({ acquired: false, reason: "no-topic" });
  // Can't translate into the source language.
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "en" }),
  ).toMatchObject({ acquired: false, reason: "source-language" });

  // Owner + completed + known language → seeds the job "translating" with the item total.
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).toMatchObject({ acquired: true, total: 2 });
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", doneId).eq("lang", "es")).unique(),
  );
  expect(job).toMatchObject({ status: "translating", total: 2, done: 0 });
});

test("tryAcquireTranslation refuses an unsupported language (bounds Edition fan-out + junk codes)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  // A non-menu / junk code is rejected before any job is seeded, so an owner can't
  // spawn unbounded billable Editions from arbitrary strings.
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "x1" }),
  ).toMatchObject({ acquired: false, reason: "unsupported-language" });
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "x1")).unique(),
  );
  expect(job).toBeNull();
});

// ---- Engine picker (translation-engine-picker) ------------------------------

test("engine defaults to gemini; a different engine flips it and forces done:0; the same engine resumes", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1); // items = title + lesson = 2
  const a = asUser(t, alice);
  const jobRow = () =>
    t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());

  // No engine arg on a fresh job → stored engine defaults to gemini, not forced.
  const first = await a.mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" });
  expect(first).toMatchObject({ acquired: true, engine: "gemini", forced: false });
  expect(await jobRow()).toMatchObject({ engine: "gemini" });

  // Mark both items fresh (a completed gemini run), then re-acquire.
  await t.run(async (ctx) => {
    const job = await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique();
    await ctx.db.insert("translations", { topicId, lang: "es", kind: "title", key: "", text: "Hindi (es)", sourceHash: itemHash("title", { text: "Hindi" }) });
    await ctx.db.patch(job!._id, { status: "ready", done: 2, failed: 0, claimedAt: undefined });
  });

  // Same engine (gemini) → resume: freshness counted, NOT forced.
  const same = await a.mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "gemini" });
  expect(same).toMatchObject({ acquired: true, engine: "gemini", forced: false });
  expect((await jobRow())!.done).toBeGreaterThan(0); // the fresh title survives as progress

  // Different engine (free) → forced full redo: stored engine flips, done reset to 0.
  await t.run(async (ctx) => {
    const job = await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique();
    await ctx.db.patch(job!._id, { status: "ready", claimedAt: undefined });
  });
  const switched = await a.mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  expect(switched).toMatchObject({ acquired: true, engine: "free", forced: true });
  expect(await jobRow()).toMatchObject({ engine: "free", done: 0 });
});

test("a forced engine switch DELETES the old engine's rows — `done: 0` alone left them to be miscounted as fresh on a later resume", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1); // items = title + lesson = 2
  const a = asUser(t, alice);
  const rows = () =>
    t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());

  // A completed gemini run: both items translated and fresh.
  await a.mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "gemini" });
  const secret = "test-secret";
  await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "title", key: "", text: "Hindi (gemini)" });
  await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "lesson", key: "0001", title: "L", html: "<p>gemini</p>" });
  await t.mutation(api.translate.reportTranslation, { secret, topicSlug: "hindi", lang: "es", outcome: "ready" });
  expect(await rows()).toHaveLength(2);

  // The owner switches engine. `forced` exists precisely because per-item
  // freshness is engine-blind and would mistake the old engine's rows for "already
  // done" — but resetting `done` never removed them, so a forced redo that died
  // halfway left a later (unforced) resume skipping the very items it had to redo.
  // Discarding the rows is what actually delivers the intent.
  const switched = await a.mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  expect(switched).toMatchObject({ acquired: true, engine: "free", forced: true });
  expect(await rows()).toHaveLength(0);
  // With the rows gone, nothing can read as fresh — the redo really is full.
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique(),
  );
  expect(job).toMatchObject({ engine: "free", done: 0, total: 2 });
});

test("claimTranslation only grabs free jobs — a gemini (or absent-engine) job is never claimed", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  const secret = "test-secret";
  const dead = Date.now() - 11 * 60 * 1000; // heartbeat aged past STALE_MS

  // A dead gemini job and a dead absent-engine job — neither belongs to the cloud routine.
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 1, done: 0, failed: 0, engine: "gemini", claimedAt: dead }));
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "fr", status: "translating", total: 1, done: 0, failed: 0, claimedAt: dead }));
  expect(await t.mutation(api.translate.claimTranslation, { secret, runId: "r1" })).toBeNull();

  // A dead free job IS claimable.
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "de", status: "translating", total: 1, done: 0, failed: 0, engine: "free", claimedAt: dead }));
  expect(await t.mutation(api.translate.claimTranslation, { secret, runId: "r2" })).toMatchObject({ lang: "de" });
});

test("claimTranslation grabs a just-acquired free job immediately (regression: fresh heartbeat must not lock the routine out → 0/N stall)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  const secret = "test-secret";
  // Owner adds a FREE edition: startTranslation acquires (fresh heartbeat, no runId)
  // then fires the cloud routine. The routine MUST be able to claim it right away —
  // before this fix a fresh acquire heartbeat made the job look live, so the claim
  // returned null and the Edition sat at 0/N until STALE_MS elapsed.
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  const claim = await t.mutation(api.translate.claimTranslation, { secret, runId: "r1" });
  expect(claim).toMatchObject({ topicSlug: "hindi", lang: "es", ownerEmail: "alice@example.com" });
  // Once claimed (runId stamped, fresh heartbeat) the run owns it — single-flight.
  expect(await t.mutation(api.translate.claimTranslation, { secret, runId: "r2" })).toBeNull();
});

test("tryAcquireTranslation refuses to re-run while a job is still translating (single-flight)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).toMatchObject({ acquired: true });
  // Job is now "translating"; a second acquire is refused — otherwise the routine
  // double-fires and the job could flip "ready" while items are still in flight.
  expect(
    await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).toMatchObject({ acquired: false, reason: "already-translating" });
});

// ---- The translate Routine's seams (PUBLISH_SECRET-guarded) -----------------

test("claim → publish → report round-trips one Edition, and the reader serves it", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  // Owner fires the FREE engine: seeds the job "translating" (total = title + the
  // one lesson = 2). The claim seam only ever grabs `free` jobs (the cloud routine).
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });

  const secret = "test-secret";
  // The fired run claims the just-acquired Edition immediately — no waiting for the
  // acquire heartbeat to go stale — and learns the (Topic, language, owner).
  const claim = await t.mutation(api.translate.claimTranslation, { secret, runId: "r1" });
  expect(claim).toMatchObject({ topicSlug: "hindi", lang: "es", ownerEmail: "alice@example.com" });
  // A second claim finds nothing — the job is now claimed (single-flight).
  expect(await t.mutation(api.translate.claimTranslation, { secret, runId: "r2" })).toBeNull();

  // The run publishes the translated title + lesson.
  expect(
    await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "title", key: "", text: "Hindi (es)" }),
  ).toEqual({ status: "saved" });
  expect(
    await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "lesson", key: "0001", title: "Lección", html: "<p>es</p>" }),
  ).toEqual({ status: "saved" });

  // The run reports ready → the job is usable, done ticked, nothing failed.
  await t.mutation(api.translate.reportTranslation, { secret, topicSlug: "hindi", lang: "es", outcome: "ready" });
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique(),
  );
  expect(job).toMatchObject({ status: "ready", done: 2, failed: 0 });
  // The owner now reads the Spanish edition (they hold every ready Edition).
  expect(await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "es" })).toMatchObject({
    html: "<p>es</p>",
    title: "Lección",
  });
});

// Documents the hole, so it can't quietly widen again: the bare mutation still
// does not guard a blob-backed source. That is why every caller outside
// `translateTopic` must publish through `publishTranslationChecked` (below).
test("publishTranslation still does NOT quiz-guard a blob-backed source — the guarded door is publishTranslationChecked", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  // The source body lives in a content blob, so the quiz-structure guard can't
  // read the source markup in a mutation (see translate.ts) — the check is skipped
  // for the trusted, secret-guarded run and the translated row is written as-is.
  const sid = await t.run((ctx) => ctx.storage.store(new Blob(['<div data-correct="a"></div>'], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1", htmlStorageId: sid }));
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" });

  // Even a translation that dropped the quiz marker is saved — the guard is bypassed.
  expect(
    await t.mutation(api.translate.publishTranslation, {
      secret: "test-secret",
      ownerEmail: "alice@example.com",
      topicSlug: "hindi",
      lang: "es",
      kind: "lesson",
      key: "0001",
      title: "L1",
      html: "<div></div>",
    }),
  ).toEqual({ status: "saved" });
  const row = await t.run((ctx) =>
    ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", "lesson").eq("key", "0001"))
      .unique(),
  );
  expect(row).toMatchObject({ kind: "lesson", key: "0001", html: "<div></div>" });
});

test("re-publishing an identical item is `unchanged` — a cumulative wave re-publish must not inflate `done` or mask a missing item", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2); // items = title + 2 lessons = 3
  const secret = "test-secret";
  const pub = (kind: "title" | "lesson", key: string, fields: { title?: string; html?: string; text?: string }) =>
    t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind, key, ...fields });
  const jobRow = () =>
    t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());

  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  await t.mutation(api.translate.claimTranslation, { secret, runId: "r1" });

  // Wave 1 lands the title + lesson 0001.
  expect(await pub("title", "", { text: "Hindi (es)" })).toEqual({ status: "saved" });
  expect(await pub("lesson", "0001", { title: "Lección", html: "<p>es 1</p>" })).toEqual({ status: "saved" });
  expect((await jobRow())!.done).toBe(2);

  // Wave 2's publish is cumulative — the routine re-sends everything in the
  // workspace every wave (SKILL.md mandates it), so wave 1's items arrive again
  // byte-identical. That is a no-op, not progress: the docs promise the publish
  // script is idempotent, and `done` is what has to honour it.
  expect(await pub("title", "", { text: "Hindi (es)" })).toEqual({ status: "unchanged" });
  expect(await pub("lesson", "0001", { title: "Lección", html: "<p>es 1</p>" })).toEqual({ status: "unchanged" });
  expect((await jobRow())!.done).toBe(2);

  // Lesson 0002's agent was silently preempted — it never landed. Reporting ready
  // must still count it failed. When `done` accumulated per save this was
  // `max(0, 3 - 4)` → 0, so a half-translated Edition reported as complete: the
  // longer the course (the more waves), the more reliably the signal was lost.
  await t.mutation(api.translate.reportTranslation, { secret, topicSlug: "hindi", lang: "es", outcome: "ready" });
  expect(await jobRow()).toMatchObject({ status: "ready", total: 3, done: 2, failed: 1 });
});

test("a re-published item whose content CHANGED still saves and ticks (the unchanged short-circuit must not swallow a real revision)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1); // items = title + lesson = 2
  const secret = "test-secret";
  const pub = (html: string) =>
    t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "lesson", key: "0001", title: "Lección", html });
  const jobRow = () =>
    t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());

  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  expect(await pub("<p>first pass</p>")).toEqual({ status: "saved" });
  // A re-queued file (quiz drift, mismatch fix) comes back with different markup —
  // it must overwrite, and it counts as the item's progress.
  expect(await pub("<p>second pass</p>")).toEqual({ status: "saved" });
  expect((await jobRow())!.done).toBe(1); // one item, counted once — not twice
  const row = await t.run((ctx) =>
    ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", "lesson").eq("key", "0001"))
      .unique(),
  );
  expect(row).toMatchObject({ html: "<p>second pass</p>" });
});

test("reportTranslation heals a `done` already poisoned by a pre-fix run", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1); // items = title + lesson = 2
  const secret = "test-secret";
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es", engine: "free" });
  await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "title", key: "", text: "Hindi (es)" });
  await t.mutation(api.translate.publishTranslation, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", lang: "es", kind: "lesson", key: "0001", title: "Lección", html: "<p>es</p>" });
  // Stand in for an Edition whose counter was inflated by cumulative re-publishing
  // before the fix (the live Slovak run reached 102/59).
  await t.run(async (ctx) => {
    const job = await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique();
    await ctx.db.patch(job!._id, { done: 102 });
  });
  // Reporting counts the real rows rather than subtracting the counter, so the
  // Edition lands truthful without a re-translate.
  await t.mutation(api.translate.reportTranslation, { secret, topicSlug: "hindi", lang: "es", outcome: "ready" });
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique(),
  );
  expect(job).toMatchObject({ status: "ready", total: 2, done: 2, failed: 0 });
});

test("the translate Routine seams reject a bad secret", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.translate.claimTranslation, { secret: "wrong", runId: "r1" })).rejects.toThrow();
});

test("editions lists English + each job with share counts", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await share(t, topicId, bob, "es");

  const eds = await asUser(t, alice).query(api.translate.editions, { topicSlug: "hindi" });
  expect(eds!.completed).toBe(true);
  const en = eds!.editions.find((e) => e.lang === "en")!;
  expect(en).toMatchObject({ source: true, status: "ready", engine: "gemini" });
  const es = eds!.editions.find((e) => e.lang === "es")!;
  // The seeded job carries no engine → surfaced as gemini (today's behaviour).
  expect(es).toMatchObject({ source: false, status: "ready", shareCount: 1, engine: "gemini" });
  // A Viewer isn't the owner → no Editions panel.
  expect(await asUser(t, bob).query(api.translate.editions, { topicSlug: "hindi" })).toBeNull();
});

// ---- Per-edition sharing + public links ------------------------------------

test("shareTopic grants one Edition; a Viewer of a non-ready language is refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección", html: "<p>es</p>" });

  // Sharing a language with no ready Edition is refused.
  await expect(
    asUser(t, alice).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "bob@example.com", lang: "fr" }),
  ).rejects.toThrow(/isn't ready/);

  // Sharing the Spanish Edition grants Bob exactly Spanish.
  expect(
    await asUser(t, alice).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "bob@example.com", lang: "es" }),
  ).toBe("shared");
  expect(await asUser(t, bob).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "es" })).toMatchObject({
    html: "<p>es</p>",
  });
  // Bob shows up in "Shared with me" holding the Spanish Edition.
  const shared = await asUser(t, bob).query(api.shares.listSharedTopics, {});
  expect(shared[0]!.langs.map((l) => l.lang)).toEqual(["es"]);
});

test("setEditionPublic refuses a non-English edition that isn't ready, but always allows revoke", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  // No ready Spanish Edition → publishing a Spanish link (which would just serve
  // English under an "es" label) is refused, mirroring shareTopic.
  await expect(
    asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true }),
  ).rejects.toThrow(/isn't ready/);
  // Once the Edition is ready, publishing mints a token.
  await addReadyJob(t, topicId, "es");
  const token = await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true });
  expect(typeof token).toBe("string");
  // Revoking never requires readiness — cleanup must always work.
  expect(
    await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: false }),
  ).toBeNull();
});

test("a per-Edition public link serves that language; a legacy token serves English", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  const sid = await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección", html: "<p>es</p>" });

  // Spanish public link (per-Edition) → the Guest reads Spanish.
  const esToken = await asUser(t, alice).mutation(api.shares.setEditionPublic, {
    topicSlug: "hindi",
    lang: "es",
    isPublic: true,
  });
  const esCourse = await t.query(api.public.publicCourse, { token: esToken! });
  expect(esCourse).toMatchObject({ title: "Hindi (es)", lang: "es", dir: "ltr" });
  expect(esCourse!.lessons[0]).toMatchObject({ title: "Lección" });
  expect(await t.query(api.public.publicLesson, { token: esToken!, key: "0001" })).toMatchObject({ html: "<p>es</p>" });

  // The legacy per-Topic token (setTopicPublic) still resolves to English.
  const enToken = await asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  const enCourse = await t.query(api.public.publicCourse, { token: enToken! });
  expect(enCourse).toMatchObject({ title: "Hindi", lang: "en" });
  expect(await t.query(api.public.publicLesson, { token: enToken!, key: "0001" })).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${sid}`) });
});

test("removeEdition drops the Edition's translations, job, shares, and public link", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await share(t, topicId, bob, "es");
  await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true });

  await asUser(t, alice).mutation(api.translate.removeEdition, { topicSlug: "hindi", lang: "es" });

  const left = await t.run(async (ctx) => ({
    translations: (await ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect()).length,
    jobs: (await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique()) === null,
    links: (await ctx.db.query("publicLinks").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect()).length,
    shares: (await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topicId)).collect()).length,
  }));
  expect(left).toEqual({ translations: 0, jobs: true, links: 0, shares: 0 });
});

// ---- cloneEdition: the clone is never reachable, and says so ---------------

// `st-ZA` was cloned onto prod on 2026-08-02 and sat invisible to every learner
// until 2026-08-04, because `cloneEdition` creates no `publishedEditions` row and
// said nothing about it. It still creates no row — copying one would publish the
// clone with NO `listings` price, and the presence of a listing row is what makes
// an Edition paid, so a paid course's clone would be readable for free. The fix is
// to make the caller's next step unmissable instead.

test("cloneEdition tells its caller the clone is unreachable, and reports what the source carried", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  // The source Edition is both catalogue-listed AND priced.
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang: "es", published: true }));
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "es", amount: 15000, currency: "ZAR" }));

  const res = await t.mutation(api.translate.cloneEdition, {
    secret: "test-secret",
    topicSlug: "hindi",
    fromLang: "es",
    toLang: "fr",
  });

  expect(res).toMatchObject({
    translations: 1,
    reachable: false,
    sourcePublished: true,
    sourcePrice: { amount: 15000, currency: "ZAR" },
  });
});

test("cloneEdition does NOT publish or price the clone — a paid Edition's clone must not become a free one", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang: "es", published: true }));
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "es", amount: 15000, currency: "ZAR" }));

  await t.mutation(api.translate.cloneEdition, { secret: "test-secret", topicSlug: "hindi", fromLang: "es", toLang: "fr" });

  const clone = await t.run(async (ctx) => ({
    published: await ctx.db.query("publishedEditions").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "fr")).unique(),
    listing: await ctx.db.query("listings").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "fr")).unique(),
  }));
  expect(clone).toEqual({ published: null, listing: null });
});

// ---- publishTranslationChecked: the quiz guard, restored for blob sources ---

// The mutation's guard went dead when Lesson bodies moved to blobs: `readSource`
// returns only an `htmlStorageId`, so `src.html !== undefined` is never true for a
// lesson and the check never fires. `translateTopic` has its own check (it holds
// the blob text already), but every OTHER caller — the teach CLI, the st-ZA
// rewrite that published 59 unchecked rows — had none. This action is the door
// those callers use: it can read the blob, so it can guard.

test("publishTranslationChecked rejects a translation that dropped a quiz marker from a blob-backed source", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  const sid = await t.run((ctx) => ctx.storage.store(new Blob(['<div data-correct="a"></div>'], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1", htmlStorageId: sid }));
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" });

  expect(
    await t.action(api.translate.publishTranslationChecked, {
      secret: "test-secret",
      ownerEmail: "alice@example.com",
      topicSlug: "hindi",
      lang: "es",
      kind: "lesson",
      key: "0001",
      title: "L1",
      html: "<div></div>", // the data-correct marker is gone — positional scoring would break
    }),
  ).toEqual({ status: "skipped" });

  const row = await t.run((ctx) =>
    ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", "lesson").eq("key", "0001"))
      .unique(),
  );
  expect(row).toBeNull(); // nothing written: the reader keeps the English fallback
});

test("publishTranslationChecked saves a translation whose quiz markers survived", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  const sid = await t.run((ctx) => ctx.storage.store(new Blob(['<div data-correct="a"></div>'], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1", htmlStorageId: sid }));
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" });

  expect(
    await t.action(api.translate.publishTranslationChecked, {
      secret: "test-secret",
      ownerEmail: "alice@example.com",
      topicSlug: "hindi",
      lang: "es",
      kind: "lesson",
      key: "0001",
      title: "L1",
      html: '<div data-correct="a">sí</div>',
    }),
  ).toEqual({ status: "saved" });
});

test("publishTranslationChecked passes non-lesson items straight through (no source markup to guard)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" });

  expect(
    await t.action(api.translate.publishTranslationChecked, {
      secret: "test-secret",
      ownerEmail: "alice@example.com",
      topicSlug: "hindi",
      lang: "es",
      kind: "title",
      key: "",
      text: "Hindi (es)",
    }),
  ).toEqual({ status: "saved" });
});

// ---- Certificate: Edition snapshot -----------------------------------------

test("a certificate snapshots the title + language of the Edition completed in", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await share(t, topicId, bob, "es");
  // Bob completes the one lesson.
  await t.run((ctx) => ctx.db.insert("progress", { userId: bob, topicId, lessonKey: "0001", status: "completed" }));

  const cert = await asUser(t, bob).mutation(api.certificates.claimCertificate, {
    topicSlug: "hindi",
    name: "Bob",
    lang: "es",
  });
  expect(cert).toMatchObject({ courseTitle: "Hindi (es)", lang: "es" });
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub).toMatchObject({ courseTitle: "Hindi (es)", lang: "es", dir: "ltr" });
});

// ---- Resource links survive translation (rich-media/11) ---------------------

test("a Resource link's href round-trips unchanged through the html translate pass", () => {
  // A Lesson cites an owned Resource by its stable id (AUTHORING.md §5–§6). The
  // href must reach the model byte-identical — a mangled or rewritten id would
  // resolve to nothing in the reader and silently kill the citation.
  const href = "/courses/hindi/resources/k17c2abf9d3e";
  const html = `<p>The perfective is formed by <a class="cite" href="${href}">the Handbook</a>.</p>`;

  // Nothing pre-processes the body: the static swap only lifts <style>/<script>.
  const { stripped, blocks } = swapOutStatic(`<style>p{color:red}</style>${html}`);
  expect(blocks).toHaveLength(1);
  expect(stripped).toContain(`href="${href}"`);

  // The model is handed the markup verbatim and told to preserve every attribute.
  const [system, user] = buildTranslateMessages(stripped, "Spanish", "html");
  expect(user?.content).toContain(`<a class="cite" href="${href}">`);
  expect(system?.content).toContain("Preserve EVERY HTML tag, attribute, and value EXACTLY");

  // And the swap-back restores the document with the href still intact.
  expect(swapBackStatic(stripped, blocks)).toContain(`href="${href}"`);
});
