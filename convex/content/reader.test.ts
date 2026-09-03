/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { decodeEntities } from "../contentBlobs";
import schema from "../schema";
import { asUser, seedMember, seedTopic, seedUser } from "./testHelpers";

const modules = import.meta.glob("/convex/**/*.ts");

test("listTopics returns only the signed-in user's topics", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi", "Hindi", 1);
  await seedTopic(t, bob, "spanish", "Spanish", 1);

  const aliceTopics = await asUser(t, alice).query(api.content.reader.listTopics, {});
  expect(aliceTopics.map((x) => x.slug)).toEqual(["hindi"]);
});

test("decodeEntities turns entity-encoded titles back into plain text", () => {
  expect(decodeEntities("Course Map &amp; Reading List")).toBe("Course Map & Reading List");
  expect(decodeEntities("&lt;a&gt; &quot;x&quot; &#39;y&#39;")).toBe('<a> "x" \'y\'');
  expect(decodeEntities("nothing to decode")).toBe("nothing to decode");
});

test("listTopics orders by seq then creation, unsequenced last", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "third", "Third"); // no seq → last
  await seedTopic(t, alice, "first", "First", 1);
  await seedTopic(t, alice, "second", "Second", 2);

  const topics = await asUser(t, alice).query(api.content.reader.listTopics, {});
  expect(topics.map((x) => x.slug)).toEqual(["first", "second", "third"]);
});

test("listLessons is seq-ordered and excludes superseded lessons", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B" });
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", supersededBy: "0001-a" });
  });

  const lessons = await asUser(t, alice).query(api.content.reader.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => l.key)).toEqual(["0001-a", "0002-b"]);
});

test("cross-owner isolation: a user asking for another's topicSlug gets nothing", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const bobTopic = await seedTopic(t, bob, "hindi", "Hindi", 1);
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: bobTopic, key: "0001-a", seq: 1, title: "A" }));

  const asAlice = asUser(t, alice);
  expect(await asAlice.query(api.content.reader.listLessons, { topicSlug: "hindi" })).toEqual([]);
  expect(await asAlice.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001-a" })).toBeNull();
  expect(await asAlice.query(api.content.reader.listReferences, { topicSlug: "hindi" })).toEqual([]);
});

test("getLesson / listReferences / getReference are owner+topic scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const { lessonSid, refSid } = await t.run(async (ctx) => {
    const lessonSid = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    const refSid = await ctx.storage.store(new Blob(["<p>ref</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", htmlStorageId: lessonSid });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", htmlStorageId: refSid, contentHash: "h" });
    return { lessonSid, refSid };
  });
  const asAlice = asUser(t, alice);

  expect(await asAlice.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001-a" })).toMatchObject({ key: "0001-a", contentUrl: expect.stringContaining(`/content?id=${lessonSid}`) });
  expect(await asAlice.query(api.content.reader.listReferences, { topicSlug: "hindi" })).toMatchObject([{ key: "grammar", title: "Grammar" }]);
  expect(await asAlice.query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ key: "grammar", contentUrl: expect.stringContaining(`/content?id=${refSid}`) });
  // wrong slug → nothing
  expect(await asAlice.query(api.content.reader.getReference, { topicSlug: "nope", key: "grammar" })).toBeNull();
});

test("getLesson / getReference serve a blob-backed row as a content URL (no inline html)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const sid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>blob body</p>"], { type: "text/html" })));
  const refSid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>ref blob</p>"], { type: "text/html" })));
  await t.run(async (ctx) => {
    // Lessons and References are always blob-backed after the narrow step — they
    // can no longer hold inline `html`, so the body is served as a `/content` URL.
    await ctx.db.insert("lessons", { topicId, key: "blob", seq: 1, title: "Blob", htmlStorageId: sid });
    await ctx.db.insert("references", { topicId, key: "g", title: "G", htmlStorageId: refSid, contentHash: "h" });
  });
  const as = asUser(t, alice);

  // Blob-backed → a content URL keyed by the storageId, and NO inline html.
  const blob = await as.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "blob" });
  expect(blob).toMatchObject({ key: "blob", contentUrl: expect.stringContaining(`/content?id=${sid}`) });
  expect(blob).not.toHaveProperty("html");

  const ref = await as.query(api.content.reader.getReference, { topicSlug: "hindi", key: "g" });
  expect(ref).toMatchObject({ key: "g", contentUrl: expect.stringContaining(`/content?id=${refSid}`) });
  expect(ref).not.toHaveProperty("html");
});

test("publicLesson serves a blob-backed lesson as a content URL", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const sid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>public blob</p>"], { type: "text/html" })));
  await t.run(async (ctx) => {
    await ctx.db.patch(topicId, { publicToken: "pubtok" });
    await ctx.db.insert("lessons", { topicId, key: "l1", seq: 1, title: "L1", htmlStorageId: sid });
  });

  const lesson = await t.query(api.public.publicLesson, { token: "pubtok", key: "l1" });
  expect(lesson).toMatchObject({ key: "l1", contentUrl: expect.stringContaining(`/content?id=${sid}`) });
  expect(lesson).not.toHaveProperty("html");
});

test("courseHeader exposes publicLink only when the course is publicly shared (reference-cards/03)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedMember(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const as = asUser(t, alice);

  // Private course: no public page for a stranger, so no share destination.
  const priv = await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" });
  expect(priv?.publicLink).toBeNull();

  // Once shared, the header carries the share token + tenant so the reader can
  // build the public `/share/<token>` link for the per-card share.
  await t.run((ctx) => ctx.db.patch(topicId, { publicToken: "pubtok", tenantSlug: "yknot" }));
  const shared = await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" });
  expect(shared?.publicLink).toEqual({ shareToken: "pubtok", tenantSlug: "yknot" });
});

test("dashboard returns the user's topics with live lesson + completed counts", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const hindi = await seedTopic(t, alice, "hindi", "Hindi", 1);
  await seedTopic(t, bob, "spanish", "Spanish", 1);
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId: hindi, key: "0001", seq: 1, title: "A" });
    await ctx.db.insert("lessons", { topicId: hindi, key: "0002", seq: 2, title: "B" });
    await ctx.db.insert("lessons", { topicId: hindi, key: "0000", seq: 0, title: "Old", supersededBy: "0001" });
    await ctx.db.insert("progress", { userId: alice, topicId: hindi, lessonKey: "0001", status: "completed" });
  });

  const cards = await asUser(t, alice).query(api.content.reader.dashboard, {});
  expect(cards.map((c) => c.slug)).toEqual(["hindi"]); // only alice's
  expect(cards[0]).toMatchObject({ lessonCount: 2, completedCount: 1 }); // superseded excluded
});

test("dashboard surfaces the estimate only for active courses that have one", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await t.run(async (ctx) => {
    // Active with an estimate → shown. Seeded/completed → hidden even though a
    // value is stored. Active with no estimate → null.
    await ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi", seq: 1, status: "active", estimatedLessons: 6 });
    await ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Greek", seq: 2, status: "seeded", estimatedLessons: 5 });
    await ctx.db.insert("topics", { ownerId: alice, slug: "latin", title: "Latin", seq: 3, status: "completed", estimatedLessons: 9 });
    await ctx.db.insert("topics", { ownerId: alice, slug: "farsi", title: "Farsi", seq: 4, status: "active" });
  });

  const cards = await asUser(t, alice).query(api.content.reader.dashboard, {});
  const bySlug = Object.fromEntries(cards.map((c) => [c.slug, c.estimatedLessons]));
  expect(bySlug).toEqual({ hindi: 6, greek: null, latin: null, farsi: null });
});

test("dashboard clamps the estimate up to the published lesson count", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi", seq: 1, status: "active", estimatedLessons: 3 }),
  );
  await t.run(async (ctx) => {
    for (let seq = 1; seq <= 5; seq++) {
      await ctx.db.insert("lessons", { topicId: hindi, key: `L${seq}`, seq, title: `L${seq}` });
    }
    // A superseded lesson must not inflate the published count.
    await ctx.db.insert("lessons", { topicId: hindi, key: "old", seq: 0, title: "Old", supersededBy: "L1" });
  });

  // max(estimate 3, published 5) = 5, so it never reads below the real count.
  expect((await asUser(t, alice).query(api.content.reader.dashboard, {}))[0]!.estimatedLessons).toBe(5);
});

test("courseHeader.canEdit: true for the owner and an Editor of the served lang, false for a Viewer", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const enEditor = await seedUser(t, "eneditor@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const lessonSid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>x</p>"], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "A", htmlStorageId: lessonSid }));
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: enEditor, lang: "en", role: "editor" }));
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  expect(await asUser(t, owner).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({ role: "owner", canEdit: true });
  expect(await asUser(t, enEditor).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({ role: "viewer", canEdit: true });
  expect(await asUser(t, viewer).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({ role: "viewer", canEdit: false });
});

// ---- The paygate lock lives server-side (architecture-deepening/03) ----------
//
// `listLessons`/`listReferences` carry a per-item `locked` computed from the same
// `lessonLocked` rule `getLesson` applies, so the TOC never re-derives it from
// `paywall.previewKey`. Moving the Preview to a different Lesson is therefore
// correct in the nav from one server-side change.

// A paid Edition (a `listings` row makes it paid) with three Lessons; the caller
// holds no grant, so `resolveEdition` classifies them `preview`.
async function seedPaidCourse(t: ReturnType<typeof convexTest>) {
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  await t.run(async (ctx) => {
    for (const [key, seq] of [["0001", 1], ["0002", 2], ["0003", 3]] as const) {
      await ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}` });
    }
    const refSid = await ctx.storage.store(new Blob(["<p>g</p>"], { type: "text/html" }));
    await ctx.db.insert("references", { topicId, key: "glossary", title: "Glossary", htmlStorageId: refSid, contentHash: "h" });
    await ctx.db.insert("listings", { topicId, lang: "en", amount: 100, currency: "zar" });
  });
  return { owner, stranger, topicId };
}

test("listLessons: a preview caller gets locked:true for every Lesson past the free Preview", async () => {
  const t = convexTest(schema, modules);
  const { stranger } = await seedPaidCourse(t);

  const lessons = await asUser(t, stranger).query(api.content.reader.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => [l.key, l.locked])).toEqual([
    ["0001", false], // the Preview — the lowest-ordered live Lesson
    ["0002", true],
    ["0003", true],
  ]);
});

test("listLessons: the lock follows the Preview when the first Lesson is superseded", async () => {
  const t = convexTest(schema, modules);
  const { stranger, topicId } = await seedPaidCourse(t);
  // Supersede 0001 → the Preview becomes 0002, with no client-side follow-up.
  await t.run(async (ctx) => {
    const first = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001"))
      .unique();
    await ctx.db.patch(first!._id, { supersededBy: "0002" });
  });

  const lessons = await asUser(t, stranger).query(api.content.reader.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => [l.key, l.locked])).toEqual([
    ["0002", false],
    ["0003", true],
  ]);
});

test("listLessons: an owner / viewer / entitled / enrolled caller gets locked:false everywhere", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await seedPaidCourse(t);
  const viewer = await seedUser(t, "viewer@example.com");
  const entitled = await seedUser(t, "entitled@example.com");
  const enrolled = await seedUser(t, "enrolled@example.com");
  await t.run(async (ctx) => {
    await ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" });
    await ctx.db.insert("entitlements", { topicId, userId: entitled, lang: "en" });
    await ctx.db.insert("enrollments", { topicId, userId: enrolled, lang: "en" });
  });

  for (const who of [owner, viewer, entitled, enrolled]) {
    const lessons = await asUser(t, who).query(api.content.reader.listLessons, { topicSlug: "hindi" });
    expect(lessons.map((l) => l.locked)).toEqual([false, false, false]);
  }
});

test("listReferences: locked wholesale for a preview caller, unlocked for a holder", async () => {
  const t = convexTest(schema, modules);
  const { owner, stranger } = await seedPaidCourse(t);

  expect(await asUser(t, stranger).query(api.content.reader.listReferences, { topicSlug: "hindi" })).toEqual([
    { key: "glossary", title: "Glossary", locked: true },
  ]);
  expect(await asUser(t, owner).query(api.content.reader.listReferences, { topicSlug: "hindi" })).toEqual([
    { key: "glossary", title: "Glossary", locked: false },
  ]);
});
