/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { decodeEntities } from "./content";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  // assertAdmin reads this at call time; ensureTopic tests need it to match.
  process.env.PUBLISH_SECRET = "test-secret";
});

// Sign in as a seeded user. `userId|session` is the subject shape Convex Auth's
// getAuthUserId parses back into the userId.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string, seq?: number) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, seq }));
}

test("listTopics returns only the signed-in user's topics", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi", "Hindi", 1);
  await seedTopic(t, bob, "spanish", "Spanish", 1);

  const aliceTopics = await asUser(t, alice).query(api.content.listTopics, {});
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

  const topics = await asUser(t, alice).query(api.content.listTopics, {});
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

  const lessons = await asUser(t, alice).query(api.content.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => l.key)).toEqual(["0001-a", "0002-b"]);
});

test("cross-owner isolation: a user asking for another's topicSlug gets nothing", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const bobTopic = await seedTopic(t, bob, "hindi", "Hindi", 1);
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: bobTopic, key: "0001-a", seq: 1, title: "A" }));

  const asAlice = asUser(t, alice);
  expect(await asAlice.query(api.content.listLessons, { topicSlug: "hindi" })).toEqual([]);
  expect(await asAlice.query(api.content.getLesson, { topicSlug: "hindi", key: "0001-a" })).toBeNull();
  expect(await asAlice.query(api.content.listReferences, { topicSlug: "hindi" })).toEqual([]);
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

  expect(await asAlice.query(api.content.getLesson, { topicSlug: "hindi", key: "0001-a" })).toMatchObject({ key: "0001-a", contentUrl: expect.stringContaining(`/content?id=${lessonSid}`) });
  expect(await asAlice.query(api.content.listReferences, { topicSlug: "hindi" })).toMatchObject([{ key: "grammar", title: "Grammar" }]);
  expect(await asAlice.query(api.content.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ key: "grammar", contentUrl: expect.stringContaining(`/content?id=${refSid}`) });
  // wrong slug → nothing
  expect(await asAlice.query(api.content.getReference, { topicSlug: "nope", key: "grammar" })).toBeNull();
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
  const blob = await as.query(api.content.getLesson, { topicSlug: "hindi", key: "blob" });
  expect(blob).toMatchObject({ key: "blob", contentUrl: expect.stringContaining(`/content?id=${sid}`) });
  expect(blob).not.toHaveProperty("html");

  const ref = await as.query(api.content.getReference, { topicSlug: "hindi", key: "g" });
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

test("publishLesson stores the body as a blob (htmlStorageId, no inline html) and stays immutable", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const secret = "test-secret";

  const sid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>body</p>"], { type: "text/html" })));
  const r1 = await t.mutation(api.content.publishLesson, { secret, topicId, key: "0001", seq: 1, title: "One", storageId: sid });
  expect(r1.status).toBe("inserted");
  const row = await t.run((ctx) =>
    ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001")).unique(),
  );
  expect(row?.htmlStorageId).toBe(sid);
  expect(row?.html).toBeUndefined();

  // Immutable: a second publish drops the redundant upload and no-ops, leaving
  // the original blob untouched.
  const sid2 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>again</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.publishLesson, { secret, topicId, key: "0001", seq: 1, title: "One", storageId: sid2 })).status).toBe("exists");
  expect(await t.run((ctx) => ctx.db.system.get(sid2))).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(sid))).not.toBeNull();

  await expect(
    t.mutation(api.content.publishLesson, { secret: "wrong", topicId, key: "x", seq: 1, title: "x", storageId: sid }),
  ).rejects.toThrow();
});

test("upsertReference inserts, drops a redundant unchanged blob, and deletes the old blob on change", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const secret = "test-secret";

  const sid1 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v1</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.upsertReference, { secret, topicId, key: "g", title: "G", storageId: sid1, contentHash: "h1" })).status).toBe("inserted");

  // Unchanged (same hash) → the new upload is redundant and dropped; row untouched.
  const dup = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v1</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.upsertReference, { secret, topicId, key: "g", title: "G", storageId: dup, contentHash: "h1" })).status).toBe("unchanged");
  expect(await t.run((ctx) => ctx.db.system.get(dup))).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(sid1))).not.toBeNull();

  // Changed → point at the new blob and delete the superseded one.
  const sid2 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v2</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.upsertReference, { secret, topicId, key: "g", title: "G2", storageId: sid2, contentHash: "h2" })).status).toBe("updated");
  const row = await t.run((ctx) =>
    ctx.db.query("references").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "g")).unique(),
  );
  expect(row?.htmlStorageId).toBe(sid2);
  expect(await t.run((ctx) => ctx.db.system.get(sid1))).toBeNull();
});

test("ensureTopic creates an owned topic, backfills an unowned one, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const secret = "test-secret";

  // Pre-existing UNOWNED legacy row (the live Hindi topic before this issue).
  const legacy = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));

  // ensureTopic backfills its ownerId rather than creating a duplicate.
  const id1 = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id1).toBe(legacy);
  const owned = await t.run((ctx) => ctx.db.get(legacy));
  expect(owned?.ownerId).toBe(alice);

  // Idempotent: a second call returns the same id, no duplicate.
  const id2 = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id2).toBe(legacy);

  // Now the owner can see it through the reader.
  const topics = await asUser(t, alice).query(api.content.listTopics, {});
  expect(topics.map((x) => x.slug)).toEqual(["hindi"]);

  // A brand-new slug creates a fresh owned topic.
  const fresh = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "spanish", title: "Spanish" });
  expect(fresh).not.toBe(legacy);
});

test("ensureTopic rejects a bad secret and an unknown owner", async () => {
  const t = convexTest(schema, modules);
  await seedUser(t, "alice@example.com");
  await expect(t.mutation(api.content.ensureTopic, { secret: "wrong", ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
  await expect(t.mutation(api.content.ensureTopic, { secret: "test-secret", ownerEmail: "ghost@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
});

test("seedTopic creates a seeded topic; identical titles get distinct slugs", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  // Slugs are globally unique, so two learners naming a course the same still get
  // distinct slugs. Two users also keeps each within the one-course-per-day cap.
  const bob = await seedUser(t, "bob@example.com");

  const r1 = await asUser(t, alice).mutation(api.content.seedTopic, { title: "Koine Greek!", why: "read the NT" });
  const r2 = await asUser(t, bob).mutation(api.content.seedTopic, { title: "Koine Greek!", why: "again" });
  expect(r1.slug).toBe("koine-greek");
  expect(r2.slug).toBe("koine-greek-2");

  const topics = await asUser(t, alice).query(api.content.listTopics, {});
  expect(topics.find((x) => x.slug === "koine-greek")).toMatchObject({ title: "Koine Greek!", status: "seeded", mission: null });
});

test("seedTopic caps a non-Admin to one new course per day; the Admin is exempt", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const as = asUser(t, alice);

  // First course of the day is allowed; a second within the day is refused.
  await as.mutation(api.content.seedTopic, { title: "Greek", why: "NT" });
  await expect(as.mutation(api.content.seedTopic, { title: "Latin", why: "Vulgate" })).rejects.toThrow(
    /one new course per day/,
  );

  // The Admin drives the app and is exempt from the cap.
  const adminEmail = "admin@example.com";
  const admin = await seedUser(t, adminEmail);
  await t.mutation(internal.whitelist.seedEmail, { email: adminEmail, isAdmin: true });
  const asAdmin = asUser(t, admin);
  await asAdmin.mutation(api.content.seedTopic, { title: "One", why: "a" });
  await asAdmin.mutation(api.content.seedTopic, { title: "Two", why: "b" }); // not blocked
  const adminTopics = await asAdmin.query(api.content.listTopics, {});
  expect(adminTopics.map((x) => x.slug).sort()).toEqual(["one", "two"]);
});

test("editMission sets the learner's mission (owner-scoped); publishMission flips status to active", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const as = asUser(t, alice);
  const secret = "test-secret";
  const { slug } = await as.mutation(api.content.seedTopic, { title: "Greek", why: "NT" });

  await as.mutation(api.content.editMission, { topicSlug: slug, mission: "Read John in Greek." });
  expect((await as.query(api.content.listTopics, {})).find((x) => x.slug === slug)?.mission).toBe("Read John in Greek.");
  // bob can't edit alice's topic
  await expect(asUser(t, bob).mutation(api.content.editMission, { topicSlug: slug, mission: "hijack" })).rejects.toThrow();

  // The Routine publishes a drafted mission and activates the topic.
  await t.mutation(api.content.publishMission, { secret, ownerEmail: "alice@example.com", topicSlug: slug, mission: "Drafted mission." });
  const topic = (await as.query(api.content.listTopics, {})).find((x) => x.slug === slug);
  expect(topic).toMatchObject({ status: "active", mission: "Drafted mission." });
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

  const cards = await asUser(t, alice).query(api.content.dashboard, {});
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

  const cards = await asUser(t, alice).query(api.content.dashboard, {});
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
  expect((await asUser(t, alice).query(api.content.dashboard, {}))[0]!.estimatedLessons).toBe(5);
});

test("renameTopic changes the title, keeps the slug, and is owner-scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi", "Hindi", 1);

  await asUser(t, alice).mutation(api.content.renameTopic, { topicSlug: "hindi", title: "Biblical Hindi" });
  expect((await asUser(t, alice).query(api.content.dashboard, {}))[0]).toMatchObject({ slug: "hindi", title: "Biblical Hindi" });
  await expect(asUser(t, bob).mutation(api.content.renameTopic, { topicSlug: "hindi", title: "x" })).rejects.toThrow();
});

// ---- editLesson: owner prose-edit of a source Lesson (course-content-editing 01)

// A quiz body whose marker counts define the lesson's positional scoring:
// data-correct=1, data-k=2, data-answer=0. The guard compares these counts.
const QUIZ_BODY =
  '<p>What is the word?</p><div class="quiz" data-correct="a"><span class="opt" data-k="a">x</span><span class="opt" data-k="b">y</span></div>';

async function storeHtml(t: ReturnType<typeof convexTest>, html: string) {
  return await t.run((ctx) => ctx.storage.store(new Blob([html], { type: "text/html" })));
}

async function seedLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, storageId: Id<"_storage">) {
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq: 1, title: "A", htmlStorageId: storageId }));
}

test("editLesson: owner edits a source Lesson — the new blob is served and the old one is deleted", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, "<p>Helo world</p>");
  await seedLesson(t, topicId, "0001", oldSid);

  // The client uploads the corrected body to a new blob and passes its storageId.
  const newSid = await storeHtml(t, "<p>Hello world</p>");
  await asUser(t, alice).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: newSid });

  const lesson = await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ key: "0001", contentUrl: expect.stringContaining(`/content?id=${newSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).toBeNull(); // old blob cleaned up
  expect(await t.run((ctx) => ctx.db.system.get(newSid))).not.toBeNull();
});

test("editLesson: rejects a structural change, cleans up the rejected blob, and leaves the old body", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", oldSid);

  // A third option adds a data-k marker → positional scoring would break → refused.
  const badSid = await storeHtml(
    t,
    QUIZ_BODY.replace("</div>", '<span class="opt" data-k="c">z</span></div>'),
  );
  await expect(
    asUser(t, alice).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: badSid }),
  ).rejects.toThrow(/quiz/i);

  // Old body untouched; the refused upload is deleted (no orphan).
  const lesson = await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(badSid))).toBeNull();
});

test("editLesson: accepts a prose-only edit that preserves the quiz markers", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", oldSid);

  // Reworded prose, same three markers → allowed.
  const goodSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Which word fits?"));
  await asUser(t, alice).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: goodSid });

  const lesson = await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${goodSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).toBeNull();
});

test("editLesson: refuses an unreadable upload and preserves the current body (no data loss)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", oldSid);

  // A well-formed storageId whose bytes don't exist (a bogus or already-consumed
  // upload). The swap must NOT proceed — else it would point the lesson at a dead
  // blob and delete the good one.
  const deadSid = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["tmp"], { type: "text/html" }));
    await ctx.storage.delete(id);
    return id;
  });
  await expect(
    asUser(t, alice).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: deadSid }),
  ).rejects.toThrow();

  const lesson = await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).not.toBeNull(); // good body survives
});

test("editLesson: refuses when the current body can't be read back, cleaning up the upload", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  // The lesson points at a storageId whose blob has since been removed — the guard
  // has no old body to check against, so a structural change can't be verified.
  const goneSid = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["x"], { type: "text/html" }));
    await ctx.storage.delete(id);
    return id;
  });
  await seedLesson(t, topicId, "0001", goneSid);

  const newSid = await storeHtml(t, "<p>new</p>");
  await expect(
    asUser(t, alice).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: newSid }),
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.system.get(newSid))).toBeNull(); // unverifiable edit cleaned up
});

test("editLesson: rejects a non-owner and an unauthenticated caller; the lesson is untouched", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, "<p>original</p>");
  await seedLesson(t, topicId, "0001", oldSid);

  const bobSid = await storeHtml(t, "<p>hijacked</p>");
  await expect(
    asUser(t, bob).action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: bobSid }),
  ).rejects.toThrow();
  await expect(
    t.action(api.content.editLesson, { topicSlug: "hindi", key: "0001", storageId: bobSid }),
  ).rejects.toThrow();

  // The owner's lesson still points at its original body.
  const lesson = await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
});
