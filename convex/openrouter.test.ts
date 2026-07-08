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
  stubModel(JSON.stringify({ lessonHtml: LESSON_FRAGMENT, learningRecord: "# Lesson 2\nlearned the aorist", estimatedLessons: 9 }));

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

  // A learning record was published for the lesson.
  const record = await t.run((ctx) =>
    ctx.db.query("learningRecords").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0002-the-aorist")).unique(),
  );
  expect(record?.markdown).toContain("learned the aorist");

  // The run reported published (lock idle) and folded the ~N estimate onto the topic.
  expect(await genStatus(t, topicId)).toBe("idle");
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.estimatedLessons).toBe(9);
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

test("a seeded course with no Frontier stays a skeleton for now (reports nothing)", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "a@e.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "seed", title: "Seed", status: "seeded", provider: "openrouter", seed: "why" }),
  );
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));
  stubModel(JSON.stringify({ lessonHtml: "x", learningRecord: "y" })); // must NOT be called

  await t.action(internal.openrouter.authorTopic, { topicSlug: "seed" });
  expect(await genStatus(t, topicId)).toBe("caughtUp"); // reported nothing
});
