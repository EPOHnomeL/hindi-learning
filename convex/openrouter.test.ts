/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});
beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-test";
});
afterEach(() => vi.unstubAllGlobals());

// Stub the OpenRouter HTTP boundary: the model "returns" `content`.
function stubModel(content: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })),
  );
}

// Stub a multi-step run: return each `contents` entry in order, capturing the
// request bodies so tests can assert on ordering + web-search plugin usage.
function stubModelSequence(contents: string[]): { bodies: any[] } {
  const bodies: any[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      const content = contents[Math.min(i++, contents.length - 1)]!;
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }),
  );
  return { bodies };
}

async function seedOngoing(t: ReturnType<typeof convexTest>) {
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "glm", title: "GLM", status: "active", provider: "openrouter" }),
  );
  await t.run(async (ctx) => {
    // A completed Frontier (seq 1) + the acquired lock, as after fireForTopic.
    await ctx.db.insert("lessons", { topicId, key: "0001-intro", seq: 1, title: "Intro", html: "<p>one</p>" });
    await ctx.db.insert("progress", { userId: alice, topicId, lessonKey: "0001-intro", status: "completed" });
    await ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 });
  });
  return { topicId };
}

const LESSON_FRAGMENT = `<title>Lesson 2 · The Aorist</title>
<header class="lesson">Aorist</header>
<div class="quiz" data-correct="c">
  <div class="q">1. Pick c</div>
  <div class="opts">
    <button class="opt" data-k="a">alpha one two</button>
    <button class="opt" data-k="b">bravo one two</button>
    <button class="opt" data-k="c">charlie one two</button>
  </div>
  <div class="fb"></div>
</div>`;

async function genStatus(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique())?.status,
  );
}

test("ongoing single-pass authors the next lesson, wraps+shuffles it, publishes a record, reports published", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedOngoing(t);
  stubModel(
    JSON.stringify({
      lessonHtml: LESSON_FRAGMENT,
      learningRecord: "# Lesson 2\nlearned the aorist",
      estimatedLessons: 9,
      references: [{ key: "aorist-forms", title: "Aorist Forms", html: "<p>forms</p>" }],
    }),
  );

  await t.action(internal.openrouter.authorTopic, { topicSlug: "glm" });

  // The new lesson is stored at seq 2, keyed from its title, wrapped as a full doc.
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  const lesson2 = lessons.find((l) => l.seq === 2);
  expect(lesson2).toBeTruthy();
  expect(lesson2!.key).toBe("0002-the-aorist");
  expect(lesson2!.title).toBe("The Aorist");
  expect(lesson2!.html).toMatch(/^<!DOCTYPE html>/);
  expect(lesson2!.html).toContain('<div class="wrap">');
  // All three options survive the shuffle (order may differ; presence must not).
  for (const k of ["a", "b", "c"]) expect(lesson2!.html).toContain(`data-k="${k}"`);

  // Any reference the lesson relies on was upserted (no dangling /references link),
  // wrapped in the reference design system so it renders styled (not a bare fragment).
  const refs = await t.run((ctx) => ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topicId)).collect());
  const ref = refs.find((r) => r.key === "aorist-forms");
  expect(ref).toBeTruthy();
  expect(ref!.html).toMatch(/^<!DOCTYPE html>/); // complete document, not a raw fragment
  expect(ref!.html).toContain("th,td{border"); // reference stylesheet present → tables styled

  // A learning record was published for the lesson.
  const record = await t.run((ctx) =>
    ctx.db.query("learningRecords").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0002-the-aorist")).unique(),
  );
  expect(record?.markdown).toContain("learned the aorist");

  // The run reported published (lock idle) and folded the ~N estimate onto the topic.
  expect(await genStatus(t, topicId)).toBe("idle");
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.estimatedLessons).toBe(9);
});

test("a run that judges the mission met completes the course (no emblem), authors nothing, reports the estimate", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedOngoing(t);
  stubModel(JSON.stringify({ complete: true, estimatedLessons: 6 }));

  await t.action(internal.openrouter.authorTopic, { topicSlug: "glm" });

  const topic = await t.run((ctx) => ctx.db.get(topicId));
  expect(topic?.status).toBe("completed"); // reader stops offering "Generate next lesson"
  expect(topic?.emblem).toBeUndefined(); // no emblem → generic 🎓 fallback
  expect(topic?.estimatedLessons).toBe(6);
  // No new lesson; the terminate run reports `nothing` (→ caughtUp, lock clean).
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons.some((l) => l.seq === 2)).toBe(false);
  expect(await genStatus(t, topicId)).toBe("caughtUp");
});

test("open learner questions are answered during the authoring run", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedOngoing(t);
  const qId = await t.run(async (ctx) => {
    const alice = (await ctx.db.query("users").first())!._id;
    return await ctx.db.insert("questions", {
      userId: alice,
      topicId,
      lessonKey: "0001-intro",
      text: "What is the aorist?",
      status: "open",
    });
  });
  stubModel(
    JSON.stringify({
      lessonHtml: LESSON_FRAGMENT,
      learningRecord: "# Lesson 2\nr",
      replies: [{ questionId: qId, reply: "A past-tense aspect." }],
    }),
  );

  await t.action(internal.openrouter.authorTopic, { topicSlug: "glm" });

  const q = await t.run((ctx) => ctx.db.get(qId));
  expect(q?.status).toBe("answered");
  expect(q?.reply).toBe("A past-tense aspect.");
});

test("a model/parse failure reports failed (retryable) and authors nothing", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedOngoing(t);
  stubModel("this is not the json contract"); // parseAuthoringResult throws

  await t.action(internal.openrouter.authorTopic, { topicSlug: "glm" });

  expect(await genStatus(t, topicId)).toBe("failed");
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons.some((l) => l.seq === 2)).toBe(false); // no lesson published
});

test("bootstrap drafts the mission (course → active) then authors lesson 1, both web-grounded", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Koine Greek", status: "seeded", provider: "openrouter", seed: "read the NT" }),
  );
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));

  const { bodies } = stubModelSequence([
    JSON.stringify({ mission: "# Mission\nRead the Greek New Testament." }),
    JSON.stringify({ lessonHtml: LESSON_FRAGMENT, learningRecord: "# Lesson 1\nalphabet", estimatedLessons: 12 }),
  ]);

  await t.action(internal.openrouter.authorTopic, { topicSlug: "greek" });

  // Step 1 published the mission and flipped the course active.
  const topic = await t.run((ctx) => ctx.db.get(topicId));
  expect(topic?.status).toBe("active");
  expect(topic?.mission).toContain("Read the Greek New Testament");

  // Step 2 authored Lesson 1 (seq 1) + a learning record.
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons.map((l) => l.seq)).toEqual([1]);
  expect(lessons[0]!.html).toMatch(/^<!DOCTYPE html>/);
  const record = await t.run((ctx) => ctx.db.query("learningRecords").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(record).toHaveLength(1);

  // Both setup calls enabled OpenRouter web search, mission before lesson.
  expect(bodies).toHaveLength(2);
  expect(bodies[0].plugins).toEqual([{ id: "web" }]);
  expect(bodies[1].plugins).toEqual([{ id: "web" }]);

  // Reported published with the estimate; lock cleared.
  expect(await genStatus(t, topicId)).toBe("idle");
  expect(topic?.estimatedLessons).toBe(12);
});

test("a mission-draft failure during bootstrap reports failed and authors nothing", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "a@e.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "seed", title: "Seed", status: "seeded", provider: "openrouter", seed: "why" }),
  );
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));
  stubModel("not the mission json contract"); // step 1 parse throws

  await t.action(internal.openrouter.authorTopic, { topicSlug: "seed" });

  expect(await genStatus(t, topicId)).toBe("failed");
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.status).toBe("seeded"); // never flipped active
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons).toHaveLength(0);
});

test("a Lesson-1 failure after the mission draft leaves the course SEEDED (re-fireable), not bricked", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "a@e.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "seed", title: "Seed", status: "seeded", provider: "openrouter", seed: "why" }),
  );
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));
  // Step 1 (mission) parses; step 2 (lesson) does not → authorTopic throws before
  // any publish, so the Mission is never published (never flips seeded → active).
  stubModelSequence([JSON.stringify({ mission: "# Mission\nx" }), "not the lesson json contract"]);

  await t.action(internal.openrouter.authorTopic, { topicSlug: "seed" });

  const topic = await t.run((ctx) => ctx.db.get(topicId));
  expect(topic?.status).toBe("seeded"); // NOT active → the gate will re-bootstrap
  expect(topic?.mission ?? null).toBeNull(); // mission never published
  const lessons = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons).toHaveLength(0);
  expect(await genStatus(t, topicId)).toBe("failed"); // retryable

  // Prove it re-bootstraps: a subsequent successful fire produces mission + Lesson 1.
  await t.run(async (ctx) => {
    const gen = await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique();
    await ctx.db.patch(gen!._id, { status: "generating", startedAt: 2, error: undefined });
  });
  stubModelSequence([
    JSON.stringify({ mission: "# Mission\nread it" }),
    JSON.stringify({ lessonHtml: LESSON_FRAGMENT, learningRecord: "# L1", estimatedLessons: 5 }),
  ]);
  await t.action(internal.openrouter.authorTopic, { topicSlug: "seed" });

  const after = await t.run((ctx) => ctx.db.get(topicId));
  expect(after?.status).toBe("active");
  expect(after?.mission).toContain("read it");
  const lessons2 = await t.run((ctx) => ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect());
  expect(lessons2).toHaveLength(1);
});
