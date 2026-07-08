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

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

// Echo the source content back as the "translation", so a lesson's quiz markers
// survive unchanged (publishTranslation's structure guard passes).
function stubEcho(): { calls: number } {
  const state = { calls: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      state.calls++;
      const body = JSON.parse(init.body as string);
      const content = body.messages[1].content;
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }),
  );
  return state;
}

async function seedCompleted(t: ReturnType<typeof convexTest>, provider?: "openrouter") {
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", {
      ownerId: alice,
      slug: "greek",
      title: "Koine Greek",
      status: "completed",
      mission: "Read the Greek NT.",
      ...(provider ? { provider } : {}),
    }),
  );
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-alpha", seq: 1, title: "Alpha", html: '<div class="quiz" data-correct="a"><div class="opts"><button class="opt" data-k="a">x</button></div></div>' }));
  return { alice, topicId };
}

test("startTranslation on an OpenRouter course schedules the translate action, no POST", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  const { calls } = stubEcho(); // must NOT be called during the fire

  // TRANSLATE_FIRE_URL is unset — the Claude POST path would fail; the OpenRouter
  // path must schedule instead.
  const res = await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es" });
  expect(res).toMatchObject({ fired: true });
  expect(calls).toBe(0);

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("translating"); // lock held until the scheduled run reports
});

test("startTranslation on a Claude course still takes the POST path (unchanged)", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t); // no provider → claude

  // No provider → Claude path attempts the routine POST; TRANSLATE_FIRE_URL unset
  // → fire-error, proving it never scheduled the OpenRouter action.
  const res = await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es" });
  expect(res).toMatchObject({ fired: false, reason: "fire-error" });
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("failed");
});

test("translateTopic translates every item via Gemini and publishes a ready Edition", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  await t.run((ctx) => ctx.db.insert("references", { topicId, key: "glossary", title: "Glossary", html: "<p>terms</p>", contentHash: "h" }));
  // The lock the fire seeds before scheduling (title + mission + lesson + reference).
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 4, done: 0, failed: 0 }));
  stubEcho();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  const rows = await t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());
  const kinds = rows.map((r) => r.kind).sort();
  expect(kinds).toEqual(["lesson", "mission", "reference", "title"]);
  // The lesson row preserved its quiz markers (structure guard passed → saved).
  expect(rows.find((r) => r.kind === "lesson")?.html).toContain('data-correct="a"');

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("ready");
  expect(job?.done).toBe(4);
});

test("a translation failure reports failed (retryable) and leaves English fallback", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream boom", { status: 500 })));

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("failed");
  const rows = await t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());
  expect(rows).toHaveLength(0); // nothing published → reader falls back to English
});
