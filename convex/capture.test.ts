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

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug }));
}

test("progress is scoped by topic — same lessonKey doesn't collide across topics", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, alice, "spanish");
  const as = asUser(t, alice);

  // Complete "0001" in hindi; spanish also has a "0001" lesson but untouched.
  await as.mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "completed" });

  const hindi = await as.query(api.capture.myProgress, { topicSlug: "hindi" });
  const spanish = await as.query(api.capture.myProgress, { topicSlug: "spanish" });
  expect(hindi).toMatchObject([{ lessonKey: "0001", status: "completed" }]);
  expect(spanish).toEqual([]);
});

test("questions are scoped by topic", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, alice, "spanish");
  const as = asUser(t, alice);

  await as.mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001", text: "why ne?" });

  const hindi = await as.query(api.capture.myQuestions, { topicSlug: "hindi" });
  const spanish = await as.query(api.capture.myQuestions, { topicSlug: "spanish" });
  expect(hindi).toMatchObject([{ lessonKey: "0001", text: "why ne?", status: "open" }]);
  expect(spanish).toEqual([]);
});

test("reviewState is scoped to one owner+topic; recordResponse is first-answer-wins", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, alice, "spanish");
  const as = asUser(t, alice);
  const secret = "test-secret";

  await as.mutation(api.capture.recordResponse, { topicSlug: "hindi", lessonKey: "0001", quizId: "q1", answer: "A", correct: true });
  await as.mutation(api.capture.recordResponse, { topicSlug: "hindi", lessonKey: "0001", quizId: "q1", answer: "B", correct: false }); // ignored
  await as.mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "opened" });
  await as.mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001", text: "hi?" });
  // Activity in another topic must not leak into hindi's reviewState.
  await as.mutation(api.capture.recordResponse, { topicSlug: "spanish", lessonKey: "0001", quizId: "q1", answer: "Z", correct: false });
  await as.mutation(api.capture.askQuestion, { topicSlug: "spanish", lessonKey: "0001", text: "hola?" });

  const state = await t.query(api.capture.reviewState, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi" });
  expect(state.responses).toEqual([{ lessonKey: "0001", quizId: "q1", answer: "A", correct: true }]); // first answer only
  expect(state.progress).toEqual([{ lessonKey: "0001", status: "opened" }]);
  expect(state.openQuestions).toMatchObject([{ lessonKey: "0001", text: "hi?" }]);
});

test("setProgress stamps lastReadAt on insert, patch, and re-open of a completed lesson", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  await as.mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "opened" });
  const inserted = await t.run(async (ctx) =>
    ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", hindi).eq("userId", alice).eq("lessonKey", "0001"))
      .unique(),
  );
  expect(typeof inserted?.lastReadAt).toBe("number");

  // Re-opening a completed lesson must not downgrade it, but must still move
  // the resume point (a re-read is the latest read).
  await as.mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "completed" });
  await t.run((ctx) => ctx.db.patch(inserted!._id, { lastReadAt: 1 }));
  await as.mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "opened" });
  const reopened = await t.run((ctx) => ctx.db.get(inserted!._id));
  expect(reopened?.status).toBe("completed");
  expect(reopened?.lastReadAt).toBeGreaterThan(1);
});

test("myLastRead returns the most recently read lesson across topics, and only the caller's", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const spanish = await seedTopic(t, alice, "spanish");

  // Explicit timestamps (not the mutation's Date.now()) so the ordering is
  // deterministic even when writes land in the same millisecond.
  await t.run(async (ctx) => {
    await ctx.db.insert("progress", { userId: alice, topicId: hindi, lessonKey: "0001", status: "completed", lastReadAt: 100 });
    await ctx.db.insert("progress", { userId: alice, topicId: spanish, lessonKey: "0002", status: "opened", lastReadAt: 200 });
    await ctx.db.insert("progress", { userId: bob, topicId: hindi, lessonKey: "0003", status: "opened", lastReadAt: 300 });
  });

  expect(await asUser(t, alice).query(api.capture.myLastRead)).toEqual({ topicSlug: "spanish", lessonKey: "0002" });
  // Bob's row points at a topic he can't view (not owner, no share): null, not a leak.
  expect(await asUser(t, bob).query(api.capture.myLastRead)).toBeNull();
});

test("myLastRead predates lastReadAt gracefully and is null signed out or with no reads", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  expect(await as.query(api.capture.myLastRead)).toBeNull();
  expect(await t.query(api.capture.myLastRead)).toBeNull();

  // A pre-migration row (no lastReadAt) still resolves rather than vanishing.
  await t.run(async (ctx) => {
    await ctx.db.insert("progress", { userId: alice, topicId: hindi, lessonKey: "0001", status: "opened" });
  });
  expect(await as.query(api.capture.myLastRead)).toEqual({ topicSlug: "hindi", lessonKey: "0001" });
});

test("the gate counts completion per topic — completing one topic doesn't open another's gate", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const spanish = await seedTopic(t, alice, "spanish");
  // Both topics' frontier lesson is keyed "0001".
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId: hindi, key: "0001", seq: 1, title: "H1" });
    await ctx.db.insert("lessons", { topicId: spanish, key: "0001", seq: 1, title: "S1" });
  });
  // Complete hindi's 0001 only.
  await asUser(t, alice).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "completed" });

  const hindiAcq = await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi" });
  expect(hindiAcq).toMatchObject({ acquired: true });
  // Spanish's 0001 is NOT completed — the gate must not be fooled by hindi's row.
  const spanishAcq = await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "spanish" });
  expect(spanishAcq).toMatchObject({ acquired: false, reason: "frontier-not-completed" });
});

// ---- Teacher Q&A (teacher-qa ticket 01) ------------------------------------
// The per-Topic show/hide for the question channel. `topics.teacherQa` is an
// optional boolean whose ABSENCE MEANS ON, which is the whole migration story:
// a Topic that has never had the field written must read exactly as one with it
// explicitly on. `content.reader.courseHeader` is the course bundle that carries
// it to the reader, and `public.publicCourse` the one that carries it to a Guest.

test("teacherQa: absence means ON, so an untouched Topic reads as one explicitly on", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "never-written");
  const explicit = await seedTopic(t, alice, "explicitly-on");
  await t.run((ctx) => ctx.db.patch(explicit, { teacherQa: true }));
  const as = asUser(t, alice);

  const untouched = await as.query(api.content.reader.courseHeader, { topicSlug: "never-written" });
  const on = await as.query(api.content.reader.courseHeader, { topicSlug: "explicitly-on" });
  expect(untouched?.teacherQa).toBe(true);
  expect(on?.teacherQa).toBe(true);
});

test("teacherQa: the owner flips it off and on, and it persists on the course bundle", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  await as.mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  expect((await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.teacherQa).toBe(false);

  await as.mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: true });
  expect((await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.teacherQa).toBe(true);
});

test("teacherQa: it is per Topic, so one course going off leaves the owner's other course on", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, alice, "spanish");
  const as = asUser(t, alice);

  await as.mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  expect((await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.teacherQa).toBe(false);
  expect((await as.query(api.content.reader.courseHeader, { topicSlug: "spanish" }))?.teacherQa).toBe(true);
});

test("teacherQa: owner-only, so a Viewer, an Editor, a tenant Admin and a stranger are refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const admin = await seedUser(t, "admin@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi", tenantSlug: "ywampotch" }),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" });
    await ctx.db.insert("shares", { topicId, viewerId: editor, lang: "en", role: "editor" });
    // A tenant Admin of the course's own tenant: an Admin row on the Allowlist.
    await ctx.db.insert("whitelist", { email: "admin@example.com", isAdmin: true, tenantSlug: "ywampotch" });
  });

  // The Translator role of CONTEXT.md is decided but NOT built (there is no
  // `translator` share role), so the built roles are covered here; a Translator
  // would be a Share holder and fails on the same owner-only gate.
  for (const who of [viewer, editor, admin, stranger]) {
    await expect(
      asUser(t, who).mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false }),
    ).rejects.toThrow();
  }
  // Signed out too.
  await expect(t.mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false })).rejects.toThrow();
  // Nothing was written by any of them.
  expect((await asUser(t, alice).query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.teacherQa).toBe(true);
});

test("teacherQa: a Viewer reads the setting on the same bundle the owner does", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  await asUser(t, alice).mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  expect((await asUser(t, viewer).query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.teacherQa).toBe(false);
});

test("teacherQa: a Guest's course bundle carries it too, absent field included", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  const token = await asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  expect((await t.query(api.public.publicCourse, { token: token! }))?.teacherQa).toBe(true);
  await asUser(t, alice).mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  expect((await t.query(api.public.publicCourse, { token: token! }))?.teacherQa).toBe(false);
});

test("teacherQa: turning it off destroys nothing, so stored Questions survive", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);
  await as.mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001", text: "why ne?" });

  await as.mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  // Ticket 01 lays the rail only: nothing is hidden yet (that is tickets 02 and
  // 03), and the Question rows are never destroyed.
  const rows = await t.run((ctx) => ctx.db.query("questions").collect());
  expect(rows).toMatchObject([{ lessonKey: "0001", text: "why ne?" }]);
});
