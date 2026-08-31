/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";
import { asUser, seedMember, seedTopic, seedUser } from "./testHelpers";

const modules = import.meta.glob("/convex/**/*.ts");

beforeAll(() => {
  // assertAdmin reads this at call time; the editMission/publishMission test
  // below crosses into the publish audience and needs it too.
  process.env.PUBLISH_SECRET = "test-secret";
});

test("deleteLesson removes the lesson and cascades its blob, record, and capture", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);

  const blobId = await t.run((ctx) => ctx.storage.store(new Blob(["<p>lesson 2</p>"], { type: "text/html" })));
  await t.run(async (ctx) => {
    // Lesson 1 was retired by lesson 2 (supersededBy points at the key we delete).
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "One", supersededBy: "0002-b" });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "Two", htmlStorageId: blobId });
    await ctx.db.insert("learningRecords", { topicId, key: "0002-b", seq: 2, markdown: "# two" });
    await ctx.db.insert("progress", { topicId, userId: alice, lessonKey: "0002-b", status: "completed" });
    await ctx.db.insert("responses", { topicId, userId: alice, lessonKey: "0002-b", quizId: "q1", answer: "a", correct: true });
    await ctx.db.insert("questions", { topicId, userId: alice, lessonKey: "0002-b", text: "why?", status: "open" });
    // Untouched neighbours (lesson 1's own record + a different lesson's response).
    await ctx.db.insert("learningRecords", { topicId, key: "0001-a", seq: 1, markdown: "# one" });
    await ctx.db.insert("responses", { topicId, userId: alice, lessonKey: "0001-a", quizId: "q1", answer: "b", correct: false });
  });

  // Only the owner may delete.
  await expect(asUser(t, bob).mutation(api.content.authoring.deleteLesson, { topicSlug: "hindi", key: "0002-b" })).rejects.toThrow();

  await asUser(t, alice).mutation(api.content.authoring.deleteLesson, { topicSlug: "hindi", key: "0002-b" });

  await t.run(async (ctx) => {
    const lessons = await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect();
    // Lesson 2 gone; lesson 1 restored (supersededBy cleared).
    expect(lessons.map((l) => l.key)).toEqual(["0001-a"]);
    expect(lessons[0]!.supersededBy).toBeUndefined();
    // Its blob was deleted.
    expect(await ctx.storage.getUrl(blobId)).toBeNull();
    // Record for the deleted key gone; lesson 1's record kept.
    const records = await ctx.db.query("learningRecords").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect();
    expect(records.map((r) => r.key)).toEqual(["0001-a"]);
    // Capture for the deleted key gone; the other lesson's response kept.
    expect((await ctx.db.query("progress").withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topicId)).collect()).length).toBe(0);
    const responses = await ctx.db.query("responses").withIndex("by_topic", (q) => q.eq("topicId", topicId)).collect();
    expect(responses.map((r) => r.lessonKey)).toEqual(["0001-a"]);
    expect((await ctx.db.query("questions").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", alice)).collect()).length).toBe(0);
  });
});

test("seedTopic creates a seeded topic; identical titles get distinct slugs", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedMember(t, "alice@example.com");
  // Slugs are globally unique, so two learners naming a course the same still get
  // distinct slugs. Two users also keeps each within the one-course-per-day cap.
  const bob = await seedMember(t, "bob@example.com");

  const r1 = await asUser(t, alice).mutation(api.content.authoring.seedTopic, { title: "Koine Greek!", why: "read the NT" });
  const r2 = await asUser(t, bob).mutation(api.content.authoring.seedTopic, { title: "Koine Greek!", why: "again" });
  expect(r1.slug).toBe("koine-greek");
  expect(r2.slug).toBe("koine-greek-2");

  const topics = await asUser(t, alice).query(api.content.reader.listTopics, {});
  expect(topics.find((x) => x.slug === "koine-greek")).toMatchObject({ title: "Koine Greek!", status: "seeded", mission: null });
});

test("seedTopic is Allowlist-gated: a signed-in non-member is refused, a member seeds", async () => {
  const t = convexTest(schema, modules);
  // Sign-up is open (ADR 0021) — an account alone doesn't grant course creation.
  const outsider = await seedUser(t, "outsider@example.com");
  await expect(asUser(t, outsider).mutation(api.content.authoring.seedTopic, { title: "Greek", why: "NT" })).rejects.toThrow();
  expect(await asUser(t, outsider).query(api.content.reader.listTopics, {})).toEqual([]);

  const member = await seedMember(t, "member@example.com");
  const { slug } = await asUser(t, member).mutation(api.content.authoring.seedTopic, { title: "Greek", why: "NT" });
  expect(slug).toBe("greek");
});

test("seedTopic persists the chosen provider; absent defaults to claude", async () => {
  const t = convexTest(schema, modules);
  // Course creation is Allowlist-gated (ADR 0021), so both authors must be members.
  const alice = await seedMember(t, "alice@example.com");
  const bob = await seedMember(t, "bob@example.com");

  // Explicit OpenRouter (the experimental line).
  const { slug: or } = await asUser(t, alice).mutation(api.content.authoring.seedTopic, {
    title: "GLM Course",
    why: "try it",
    provider: "openrouter",
  });
  // No provider supplied → the quality-guaranteed Claude default.
  const { slug: def } = await asUser(t, bob).mutation(api.content.authoring.seedTopic, { title: "Default Course", why: "x" });

  const rows = await t.run((ctx) => ctx.db.query("topics").collect());
  expect(rows.find((x) => x.slug === or)?.provider).toBe("openrouter");
  // The default topic stores no provider; readers treat absent as claude.
  expect(rows.find((x) => x.slug === def)?.provider).toBeUndefined();
});

test("seedTopic caps a non-Admin to one new course per day; the Admin is exempt", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedMember(t, "alice@example.com");
  const as = asUser(t, alice);

  // First course of the day is allowed; a second within the day is refused.
  await as.mutation(api.content.authoring.seedTopic, { title: "Greek", why: "NT" });
  await expect(as.mutation(api.content.authoring.seedTopic, { title: "Latin", why: "Vulgate" })).rejects.toThrow(
    /one new course per day/,
  );

  // The Admin drives the app and is exempt from the cap.
  const adminEmail = "admin@example.com";
  const admin = await seedUser(t, adminEmail);
  await t.mutation(internal.whitelist.seedEmail, { email: adminEmail, isAdmin: true });
  const asAdmin = asUser(t, admin);
  await asAdmin.mutation(api.content.authoring.seedTopic, { title: "One", why: "a" });
  await asAdmin.mutation(api.content.authoring.seedTopic, { title: "Two", why: "b" }); // not blocked
  const adminTopics = await asAdmin.query(api.content.reader.listTopics, {});
  expect(adminTopics.map((x) => x.slug).sort()).toEqual(["one", "two"]);
});

test("an `unlimited` Allowlist row lifts the per-day cap without granting Admin", async () => {
  const t = convexTest(schema, modules);
  // The grant this exists for: a heavy author who needs to seed many courses in a
  // sitting, but must NOT get the Admin panel with it (ADR 0032). Two separate
  // columns on the same row, so neither implies the other.
  const email = "author@example.com";
  const author = await seedUser(t, email);
  await t.mutation(internal.whitelist.seedEmail, { email, unlimited: true });
  const as = asUser(t, author);

  await as.mutation(api.content.authoring.seedTopic, { title: "One", why: "a" });
  await as.mutation(api.content.authoring.seedTopic, { title: "Two", why: "b" });
  await as.mutation(api.content.authoring.seedTopic, { title: "Three", why: "c" });
  expect((await as.query(api.content.reader.listTopics, {})).map((x) => x.slug).sort()).toEqual(["one", "three", "two"]);

  // Uncapped, but not an Admin: the panel's own gate still says no.
  expect(await as.query(api.whitelist.amIAdmin, {})).toBe(false);
  expect(await as.query(api.whitelist.myAdminScope, {})).toEqual({ role: "none", tenantSlug: null });
  await expect(as.query(api.whitelist.list, {})).rejects.toThrow(/forbidden/);
});

// editMission (authoring) is exercised alongside publishMission (publish) — this
// test genuinely crosses both audiences (it's checking that the learner's own
// edit and the Routine's write-back don't stomp on each other), so it couldn't
// be cleanly split; kept here since editMission/seedTopic are the primary subject.
test("editMission sets the learner's mission (owner-scoped); publishMission flips status to active", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedMember(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const as = asUser(t, alice);
  const secret = "test-secret";
  const { slug } = await as.mutation(api.content.authoring.seedTopic, { title: "Greek", why: "NT" });

  await as.mutation(api.content.authoring.editMission, { topicSlug: slug, mission: "Read John in Greek." });
  expect((await as.query(api.content.reader.listTopics, {})).find((x) => x.slug === slug)?.mission).toBe("Read John in Greek.");
  // bob can't edit alice's topic
  await expect(asUser(t, bob).mutation(api.content.authoring.editMission, { topicSlug: slug, mission: "hijack" })).rejects.toThrow();

  // The Routine publishes a drafted mission and activates the topic.
  await t.mutation(api.content.publish.publishMission, { secret, ownerEmail: "alice@example.com", topicSlug: slug, mission: "Drafted mission." });
  const topic = (await as.query(api.content.reader.listTopics, {})).find((x) => x.slug === slug);
  expect(topic).toMatchObject({ status: "active", mission: "Drafted mission." });
});

test("renameTopic changes the title, keeps the slug, and is owner-scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi", "Hindi", 1);

  await asUser(t, alice).mutation(api.content.authoring.renameTopic, { topicSlug: "hindi", title: "Biblical Hindi" });
  expect((await asUser(t, alice).query(api.content.reader.dashboard, {}))[0]).toMatchObject({ slug: "hindi", title: "Biblical Hindi" });
  await expect(asUser(t, bob).mutation(api.content.authoring.renameTopic, { topicSlug: "hindi", title: "x" })).rejects.toThrow();
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
  await asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: newSid });

  const lesson = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
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
    asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: badSid }),
  ).rejects.toThrow(/quiz/i);

  // Old body untouched; the refused upload is deleted (no orphan).
  const lesson = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(badSid))).toBeNull();
});

// `toThrow(/quiz/i)` above passes for a plain Error too, and a plain Error's
// message is REDACTED to "Server Error" by a production deployment — so every
// refusal below reached the live editor as noise instead of the instruction it
// was written to be. Assert the carrier, not just the wording: only a
// ConvexError's `data` crosses the wire in prod.
test("edit refusals travel as ConvexError, so their text survives a production deployment", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  await seedLesson(t, topicId, "0001", await storeHtml(t, QUIZ_BODY));
  await seedTranslatedLesson(t, topicId, "af", "0001", await storeHtml(t, QUIZ_BODY));
  await seedReference(t, topicId, "grammar", await storeHtml(t, "<p>ref</p>"));

  // A structural change to the source Lesson…
  const badSid = await storeHtml(t, QUIZ_BODY.replace("</div>", '<span class="opt" data-k="c">z</span></div>'));
  await expect(
    asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: badSid }),
  ).rejects.toMatchObject({ data: expect.stringContaining("quiz structure") });

  // …the same change to a translated Edition…
  const badTrSid = await storeHtml(t, QUIZ_BODY.replace("</div>", '<span class="opt" data-k="c">z</span></div>'));
  await expect(
    asUser(t, alice).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: badTrSid }),
  ).rejects.toMatchObject({ data: expect.stringContaining("quiz structure") });

  // …and a Reference save whose upload can't be read back.
  const deadSid = await storeHtml(t, "<p>gone</p>");
  await t.run((ctx) => ctx.storage.delete(deadSid));
  await expect(
    asUser(t, alice).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: deadSid }),
  ).rejects.toMatchObject({ data: expect.stringContaining("try saving again") });

  // A guard failure is NOT an instruction — it stays a plain Error (no `data`),
  // so prod redacting it is the intended outcome.
  const bob = await seedUser(t, "bob@example.com");
  await expect(
    asUser(t, bob).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: badSid }),
  ).rejects.not.toHaveProperty("data");
});

test("editLesson: accepts a prose-only edit that preserves the quiz markers", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", oldSid);

  // Reworded prose, same three markers → allowed.
  const goodSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Which word fits?"));
  await asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: goodSid });

  const lesson = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
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
    asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: deadSid }),
  ).rejects.toThrow();

  const lesson = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
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
    asUser(t, alice).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: newSid }),
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
    asUser(t, bob).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: bobSid }),
  ).rejects.toThrow();
  await expect(
    t.action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: bobSid }),
  ).rejects.toThrow();

  // The owner's lesson still points at its original body.
  const lesson = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(lesson).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
});

// ---- editReference: owner edit of a source Reference (course-content-editing 02)

async function seedReference(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, storageId: Id<"_storage">) {
  await t.run((ctx) => ctx.db.insert("references", { topicId, key, title: "Grammar", htmlStorageId: storageId, contentHash: "h" }));
}

test("editReference: owner edits a Reference — new blob served, old deleted, no quiz guard", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, "<p>old cheat-sheet</p>");
  await seedReference(t, topicId, "grammar", oldSid);

  // References are mutable (ADR 0003) — even a body carrying quiz-like markers is
  // accepted, since no structure guard applies.
  const newSid = await storeHtml(t, QUIZ_BODY);
  await asUser(t, alice).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: newSid });

  const ref = await asUser(t, alice).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" });
  expect(ref).toMatchObject({ key: "grammar", contentUrl: expect.stringContaining(`/content?id=${newSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).toBeNull(); // old blob cleaned up
  expect(await t.run((ctx) => ctx.db.system.get(newSid))).not.toBeNull();
});

test("editReference: refuses an unreadable upload and preserves the current body", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, "<p>good body</p>");
  await seedReference(t, topicId, "grammar", oldSid);

  const deadSid = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["tmp"], { type: "text/html" }));
    await ctx.storage.delete(id);
    return id;
  });
  await expect(
    asUser(t, alice).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: deadSid }),
  ).rejects.toThrow();

  const ref = await asUser(t, alice).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" });
  expect(ref).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).not.toBeNull();
});

test("editReference: rejects a non-owner and an unauthenticated caller; the reference is untouched", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, "<p>original</p>");
  await seedReference(t, topicId, "grammar", oldSid);

  const bobSid = await storeHtml(t, "<p>hijacked</p>");
  await expect(
    asUser(t, bob).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: bobSid }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: bobSid }),
  ).rejects.toThrow();

  const ref = await asUser(t, alice).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" });
  expect(ref).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldSid}`) });
});

// ---- editTranslatedLesson: owner edit of a translated Edition (content-editing 03)

// Seed a Lesson translated into `lang` (a blob-backed translations row) and mark
// the Edition ready so the owner holds it (getLesson serves it).
async function seedTranslatedLesson(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  lang: string,
  key: string,
  storageId: Id<"_storage"> | null,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 });
    if (storageId) {
      await ctx.db.insert("translations", {
        topicId,
        lang,
        kind: "lesson",
        key,
        htmlStorageId: storageId,
        sourceHash: "seed",
      });
    }
  });
}

test("editTranslatedLesson: owner edits a translated Lesson — round-trips, old blob deleted, source unchanged", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid);
  const oldTrSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Wat is die woord?"));
  await seedTranslatedLesson(t, topicId, "af", "0001", oldTrSid);

  // Prose-only fix in the Afrikaans Edition — same markers as the English source.
  const newTrSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Watter woord pas?"));
  await asUser(t, alice).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: newTrSid });

  // The af Edition serves the new body; English source is unchanged.
  const af = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "af" });
  expect(af).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${newTrSid}`) });
  const en = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(en).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${srcSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldTrSid))).toBeNull(); // old translated blob gone
  expect(await t.run((ctx) => ctx.db.system.get(srcSid))).not.toBeNull(); // source blob untouched
});

test("editTranslatedLesson: rejects a structural change against the source markers, keeps the old body", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY); // data-k = 2
  await seedLesson(t, topicId, "0001", srcSid);
  const oldTrSid = await storeHtml(t, QUIZ_BODY);
  await seedTranslatedLesson(t, topicId, "af", "0001", oldTrSid);

  // A third option changes the marker counts vs the source → refused.
  const badSid = await storeHtml(t, QUIZ_BODY.replace("</div>", '<span class="opt" data-k="c">z</span></div>'));
  await expect(
    asUser(t, alice).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: badSid }),
  ).rejects.toThrow(/quiz/i);

  const af = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "af" });
  expect(af).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${oldTrSid}`) });
  expect(await t.run((ctx) => ctx.db.system.get(oldTrSid))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(badSid))).toBeNull();
});

test("editTranslatedLesson: creates a translation row when the Edition had none (untranslated term)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid);
  await seedTranslatedLesson(t, topicId, "af", "0001", null); // ready Edition, no row → English fallback

  const newSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Watter woord pas?"));
  await asUser(t, alice).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: newSid });

  const af = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "af" });
  expect(af).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${newSid}`) });
  // English source still served on the source Edition.
  const en = await asUser(t, alice).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" });
  expect(en).toMatchObject({ contentUrl: expect.stringContaining(`/content?id=${srcSid}`) });
});

test("editTranslatedLesson: rejects a non-owner, a Viewer of the Edition, and an unauthenticated caller", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid);
  const oldTrSid = await storeHtml(t, QUIZ_BODY);
  await seedTranslatedLesson(t, topicId, "af", "0001", oldTrSid);
  // bob is a Viewer of the af Edition — still can't edit it.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: bob, lang: "af" }));

  const bobSid = await storeHtml(t, QUIZ_BODY);
  await expect(
    asUser(t, bob).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: bobSid }),
  ).rejects.toThrow();
  await expect(
    t.action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: bobSid }),
  ).rejects.toThrow();

  // The translated row still points at its original body.
  const row = await t.run((ctx) =>
    ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "af").eq("kind", "lesson").eq("key", "0001"))
      .unique(),
  );
  expect(row?.htmlStorageId).toBe(oldTrSid);
});

// ---- Editor enforcement on edit mutations (edition-editor-rights issue 02) ---

// Grant `editor` on one Edition (lang) of a Topic. Editors edit exactly the
// owner's hover-pencil prose, scoped to that Edition (ADR 0020).
async function seedEditorShare(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, editorId: Id<"users">, lang: string) {
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: editorId, lang, role: "editor" }));
}

test("editor enforcement: an English-edition Editor can editLesson and editReference; the read seam serves the new bodies", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const lessonSid = await storeHtml(t, "<p>Helo</p>");
  await seedLesson(t, topicId, "0001", lessonSid);
  const refSid = await storeHtml(t, "<p>old ref</p>");
  await seedReference(t, topicId, "grammar", refSid);
  await seedEditorShare(t, topicId, editor, "en");

  // Editor edits the source Lesson.
  const newLessonSid = await storeHtml(t, "<p>Hello</p>");
  await asUser(t, editor).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: newLessonSid });
  expect(await asUser(t, editor).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${newLessonSid}`),
  });

  // Editor edits the source Reference.
  const newRefSid = await storeHtml(t, "<p>new ref</p>");
  await asUser(t, editor).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: newRefSid });
  expect(await asUser(t, editor).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${newRefSid}`),
  });
});

test("editor enforcement: a translated-edition Editor can editTranslatedLesson; the English source is untouched", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid);
  const oldTrSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Wat is die woord?"));
  await seedTranslatedLesson(t, topicId, "af", "0001", oldTrSid);
  await seedEditorShare(t, topicId, editor, "af");

  const newTrSid = await storeHtml(t, QUIZ_BODY.replace("What is the word?", "Watter woord pas?"));
  await asUser(t, editor).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: newTrSid });

  expect(await asUser(t, editor).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "af" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${newTrSid}`),
  });
  // The English source row is unchanged (owner reads it on the source Edition).
  expect(await asUser(t, owner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${srcSid}`),
  });
});

test("editor enforcement: a plain Viewer, a wrong-lang Editor, and a stranger are all rejected", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const afEditor = await seedUser(t, "afeditor@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid);
  await seedReference(t, topicId, "grammar", await storeHtml(t, "<p>ref</p>"));
  await seedTranslatedLesson(t, topicId, "af", "0001", await storeHtml(t, QUIZ_BODY));
  // viewer holds a read-only English Share; afEditor is an Editor of af ONLY.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));
  await seedEditorShare(t, topicId, afEditor, "af");

  const sid = await storeHtml(t, QUIZ_BODY);
  // A plain Viewer cannot touch any of the three.
  await expect(asUser(t, viewer).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: sid })).rejects.toThrow();
  await expect(asUser(t, viewer).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: sid })).rejects.toThrow();
  await expect(asUser(t, viewer).action(api.content.authoring.editTranslatedLesson, { topicSlug: "hindi", key: "0001", lang: "af", storageId: sid })).rejects.toThrow();
  // The af Editor cannot edit the English source Lesson or Reference (lang X ≠ lang Y).
  await expect(asUser(t, afEditor).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: sid })).rejects.toThrow();
  await expect(asUser(t, afEditor).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: sid })).rejects.toThrow();
  // A stranger (no Share at all) is rejected everywhere, as is an unauthenticated caller.
  await expect(asUser(t, stranger).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: sid })).rejects.toThrow();
  await expect(t.action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: sid })).rejects.toThrow();

  // The source Lesson still points at its original body after all rejections.
  expect(await asUser(t, owner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${srcSid}`),
  });
});

// The save is TWO calls — mint an upload URL, then the write — and until
// 2026-08-05 only the write was covered here, so `generateEditUploadUrl` sat
// owner-only and every Editor's save died at the FIRST call with a bare "Server
// Error". Guard the mint with the same trust boundary as the write.
test("edit upload URL: an Editor of the Edition can mint one; a Viewer, a wrong-lang Editor and a stranger cannot", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const enEditor = await seedUser(t, "eneditor@example.com");
  const afEditor = await seedUser(t, "afeditor@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  await seedLesson(t, topicId, "0001", await storeHtml(t, QUIZ_BODY));
  await seedEditorShare(t, topicId, enEditor, "en");
  await seedEditorShare(t, topicId, afEditor, "af");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  const mint = api.content.authoring.generateEditUploadUrl;
  // Owner, on the source (no `lang`) and on a translated Edition.
  expect(await asUser(t, owner).mutation(mint, { topicSlug: "hindi" })).toEqual(expect.any(String));
  expect(await asUser(t, owner).mutation(mint, { topicSlug: "hindi", lang: "af" })).toEqual(expect.any(String));
  // Each Editor on their OWN Edition — this is what the bug broke.
  expect(await asUser(t, enEditor).mutation(mint, { topicSlug: "hindi" })).toEqual(expect.any(String));
  expect(await asUser(t, afEditor).mutation(mint, { topicSlug: "hindi", lang: "af" })).toEqual(expect.any(String));
  // …and not on anyone else's: the mint is per-Edition, like the write.
  await expect(asUser(t, enEditor).mutation(mint, { topicSlug: "hindi", lang: "af" })).rejects.toThrow();
  await expect(asUser(t, afEditor).mutation(mint, { topicSlug: "hindi" })).rejects.toThrow();
  await expect(asUser(t, viewer).mutation(mint, { topicSlug: "hindi" })).rejects.toThrow();
  await expect(asUser(t, stranger).mutation(mint, { topicSlug: "hindi" })).rejects.toThrow();
  await expect(t.mutation(mint, { topicSlug: "hindi" })).rejects.toThrow();
});

test("editor enforcement: the quiz-structure guard still rejects a structural change made by an Editor", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const oldSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", oldSid);
  await seedEditorShare(t, topicId, editor, "en");

  // A third option adds a data-k marker → positional scoring breaks → refused,
  // exactly as it would be for the owner.
  const badSid = await storeHtml(t, QUIZ_BODY.replace("</div>", '<span class="opt" data-k="c">z</span></div>'));
  await expect(
    asUser(t, editor).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: badSid }),
  ).rejects.toThrow(/quiz/i);
  expect(await asUser(t, editor).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${oldSid}`),
  });
});

// ---- editTranslatedReference + the in-editor rename (editing-obviousness) ----
//
// Reference editing was source-only until 2026-08-31, so a translator holding an
// Editor share on their own Edition could fix every Lesson but neither the
// grammar sheet nor the glossary. Titles were editable nowhere at all.

// Mark `lang` a ready Edition so the owner (and its Editor) holds it, with an
// optional translated Reference row already in place.
async function seedTranslatedReference(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  lang: string,
  key: string,
  storageId: Id<"_storage"> | null,
  title?: string,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 });
    if (storageId) {
      await ctx.db.insert("translations", { topicId, lang, kind: "reference", key, htmlStorageId: storageId, sourceHash: "seed", ...(title ? { title } : {}) });
    }
  });
}

test("editTranslatedReference: an Editor of that Edition fixes the glossary; the English source is untouched", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, "<p>English glossary</p>");
  await seedReference(t, topicId, "glossary", srcSid);
  const oldSid = await storeHtml(t, "<p>Nederlandse woordenlijst</p>");
  await seedTranslatedReference(t, topicId, "nl", "glossary", oldSid);
  await seedEditorShare(t, topicId, editor, "nl");

  const newSid = await storeHtml(t, "<p>Nederlandse woordenlijst, gecorrigeerd</p>");
  await asUser(t, editor).mutation(api.content.authoring.editTranslatedReference, { topicSlug: "hindi", key: "glossary", lang: "nl", storageId: newSid });

  expect(await asUser(t, editor).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary", lang: "nl" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${newSid}`),
  });
  // The source Edition still serves English, and its blob is untouched.
  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${srcSid}`),
  });
  expect(await t.run((ctx) => ctx.db.system.get(srcSid))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).toBeNull(); // old translated blob cleaned up
});

test("editTranslatedReference: creates a row when the Edition had none, so an English-fallback reference becomes translated", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, "<p>English glossary</p>");
  await seedReference(t, topicId, "glossary", srcSid);
  await seedTranslatedReference(t, topicId, "nl", "glossary", null); // ready Edition, no row

  const newSid = await storeHtml(t, "<p>Woordenlijst</p>");
  await asUser(t, owner).mutation(api.content.authoring.editTranslatedReference, { topicSlug: "hindi", key: "glossary", lang: "nl", storageId: newSid });

  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary", lang: "nl" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${newSid}`),
  });
  // Stamped with the CURRENT source hash, so a later re-translate of an unchanged
  // source skips this item and keeps the manual fix (mirrors the Lesson path).
  const row = await t.run((ctx) =>
    ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "nl").eq("kind", "reference").eq("key", "glossary")).unique(),
  );
  expect(row?.sourceHash).not.toBe("seed");
  expect(row?.sourceHash).toBeTruthy();
});

test("editTranslatedReference: refuses the source language, another Edition's Editor, a Viewer, and an anonymous caller", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const frEditor = await seedUser(t, "fr@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, "<p>English glossary</p>");
  await seedReference(t, topicId, "glossary", srcSid);
  const oldSid = await storeHtml(t, "<p>Woordenlijst</p>");
  await seedTranslatedReference(t, topicId, "nl", "glossary", oldSid);
  await seedEditorShare(t, topicId, frEditor, "fr");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "nl" }));

  const sid = await storeHtml(t, "<p>hijacked</p>");
  const call = (as: Id<"users"> | null, lang: string) =>
    (as ? asUser(t, as) : t).mutation(api.content.authoring.editTranslatedReference, { topicSlug: "hindi", key: "glossary", lang, storageId: sid });
  // The source Edition has no translations row: editReference is its write path.
  await expect(call(owner, "en")).rejects.toThrow();
  await expect(call(frEditor, "nl")).rejects.toThrow(); // Editor of fr, not nl
  await expect(call(viewer, "nl")).rejects.toThrow(); // read-only Share
  await expect(call(null, "nl")).rejects.toThrow();

  const row = await t.run((ctx) =>
    ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "nl").eq("kind", "reference").eq("key", "glossary")).unique(),
  );
  expect(row?.htmlStorageId).toBe(oldSid);
});

test("editTranslatedReference: refuses an unreadable upload and preserves the current body", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, "<p>English glossary</p>");
  await seedReference(t, topicId, "glossary", srcSid);
  const oldSid = await storeHtml(t, "<p>Woordenlijst</p>");
  await seedTranslatedReference(t, topicId, "nl", "glossary", oldSid);

  const deadSid = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["tmp"], { type: "text/html" }));
    await ctx.storage.delete(id);
    return id;
  });
  await expect(
    asUser(t, owner).mutation(api.content.authoring.editTranslatedReference, { topicSlug: "hindi", key: "glossary", lang: "nl", storageId: deadSid }),
  ).rejects.toThrow();

  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary", lang: "nl" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${oldSid}`),
  });
  expect(await t.run((ctx) => ctx.db.system.get(oldSid))).not.toBeNull();
});

test("rename: a title arg on a source save renames the Lesson and the Reference", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const lessonSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", lessonSid); // title "A"
  const refSid = await storeHtml(t, "<p>ref</p>");
  await seedReference(t, topicId, "grammar", refSid); // title "Grammar"
  await seedEditorShare(t, topicId, editor, "en");

  // Whoever may rewrite the body may rename it (spec D2), Editor included.
  await asUser(t, editor).action(api.content.authoring.editLesson, {
    topicSlug: "hindi", key: "0001", storageId: await storeHtml(t, QUIZ_BODY), title: "  The aorist  ",
  });
  await asUser(t, editor).mutation(api.content.authoring.editReference, {
    topicSlug: "hindi", key: "grammar", storageId: await storeHtml(t, "<p>ref2</p>"), title: "Grammar sheet",
  });

  expect(await asUser(t, owner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({ title: "The aorist" });
  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ title: "Grammar sheet" });
});

test("rename: a title arg on a translated save renames only that Edition; the source titles stand", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  const srcSid = await storeHtml(t, QUIZ_BODY);
  await seedLesson(t, topicId, "0001", srcSid); // title "A"
  const refSid = await storeHtml(t, "<p>ref</p>");
  await seedReference(t, topicId, "glossary", refSid); // title "Grammar"
  await seedTranslatedReference(t, topicId, "nl", "glossary", null); // ready nl Edition
  await seedEditorShare(t, topicId, editor, "nl");

  await asUser(t, editor).action(api.content.authoring.editTranslatedLesson, {
    topicSlug: "hindi", key: "0001", lang: "nl", storageId: await storeHtml(t, QUIZ_BODY), title: "De aoristus",
  });
  await asUser(t, editor).mutation(api.content.authoring.editTranslatedReference, {
    topicSlug: "hindi", key: "glossary", lang: "nl", storageId: await storeHtml(t, "<p>x</p>"), title: "Woordenlijst",
  });

  expect(await asUser(t, editor).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001", lang: "nl" })).toMatchObject({ title: "De aoristus" });
  expect(await asUser(t, editor).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary", lang: "nl" })).toMatchObject({ title: "Woordenlijst" });
  // A source rename leaves translated Editions alone and vice versa (spec D3).
  expect(await asUser(t, owner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({ title: "A" });
  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "glossary" })).toMatchObject({ title: "Grammar" });
});

test("rename: an absent or blank title leaves the current one alone, so a body-only save never clears it", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", 1);
  await seedLesson(t, topicId, "0001", await storeHtml(t, QUIZ_BODY)); // title "A"
  await seedReference(t, topicId, "grammar", await storeHtml(t, "<p>ref</p>")); // title "Grammar"
  await seedTranslatedReference(t, topicId, "nl", "grammar", await storeHtml(t, "<p>nl</p>"), "Grammatica");

  await asUser(t, owner).action(api.content.authoring.editLesson, { topicSlug: "hindi", key: "0001", storageId: await storeHtml(t, QUIZ_BODY) });
  await asUser(t, owner).mutation(api.content.authoring.editReference, { topicSlug: "hindi", key: "grammar", storageId: await storeHtml(t, "<p>r</p>"), title: "   " });
  await asUser(t, owner).mutation(api.content.authoring.editTranslatedReference, { topicSlug: "hindi", key: "grammar", lang: "nl", storageId: await storeHtml(t, "<p>n</p>"), title: "" });

  expect(await asUser(t, owner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({ title: "A" });
  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ title: "Grammar" });
  expect(await asUser(t, owner).query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar", lang: "nl" })).toMatchObject({ title: "Grammatica" });
});
