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
  // Default provider (TRANSLATE_PROVIDER unset ⇒ gemini): the migration target.
  delete process.env.TRANSLATE_PROVIDER;
  process.env.GOOGLE_AI_API_KEY = "ai-studio-test";
});
afterEach(() => vi.unstubAllGlobals());

// A realistic lesson document: styles in the head, quiz markup in the body,
// scripts at the foot — the shape every published Lesson blob has.
const LESSON_DOC = `<!doctype html><html><head><meta charset="utf-8"><title>Alpha</title><style>.quiz{color:red}</style></head><body><h1>Read this</h1><div class="quiz" data-correct="a"><button class="opt" data-k="a">yes</button></div><script>var boiler=1;</script><script src="./foot.js"></script></body></html>`;

// Echo the user turn back as the native Gemini "translation", so a lesson's quiz
// markers survive unchanged (the action's structure guard passes). Optionally
// mangle only the HTML-mode calls (system prompt mentions "HTML").
function stubGemini(mangle?: (s: string) => string): { calls: number; urls: string[]; bodies: Record<string, unknown>[] } {
  const state = { calls: 0, urls: [] as string[], bodies: [] as Record<string, unknown>[] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      state.calls++;
      state.urls.push(url);
      const body = JSON.parse(init.body as string);
      state.bodies.push(body);
      const content = body.contents[0].parts[0].text as string;
      const isHtml = (body.systemInstruction?.parts?.[0]?.text as string | undefined)?.includes("HTML");
      const out = mangle && isHtml ? mangle(content) : content;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: out }] } }] }), { status: 200 });
    }),
  );
  return state;
}

async function seedCompleted(t: ReturnType<typeof convexTest>, lessonDoc = '<div class="quiz" data-correct="a"><div class="opts"><button class="opt" data-k="a">x</button></div></div>') {
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Koine Greek", status: "completed", mission: "Read the Greek NT.", provider: "openrouter" }),
  );
  await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob([lessonDoc], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-alpha", seq: 1, title: "Alpha", htmlStorageId: sid });
  });
  return { alice, topicId };
}

test("the default provider routes translation to the native Gemini API with thinking disabled", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t);
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  const gemini = stubGemini();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  expect(gemini.calls).toBeGreaterThan(0);
  // Native AI Studio endpoint, keyed header, no OpenRouter chat-completions shape.
  for (const url of gemini.urls) {
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain(":generateContent");
  }
  for (const b of gemini.bodies) {
    expect((b.generationConfig as { thinkingConfig: { thinkingBudget: number } }).thinkingConfig.thinkingBudget).toBe(0);
    expect(b.messages).toBeUndefined();
    expect(b.reasoning).toBeUndefined();
  }
});

test("the run sends bodies without style/script and publishes them restored (default Gemini path)", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, LESSON_DOC);
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  const gemini = stubGemini();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  // No request carried the boilerplate — that's the token cut.
  for (const b of gemini.bodies) {
    const sent = (b.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect(sent).not.toContain("color:red");
    expect(sent).not.toContain("var boiler=1");
  }
  const row = await t.run((ctx) =>
    ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", "lesson").eq("key", "0001-alpha")).unique(),
  );
  expect(row?.html).toContain("<style>.quiz{color:red}</style>");
  expect(row?.html).toContain("var boiler=1");
  expect(row?.html).toContain("data-correct");
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job).toMatchObject({ status: "ready", done: 3, failed: 0 });
});

test("a run that loses placeholders or quiz markers skips the item (English fallback), never publishing a corrupt body", async () => {
  for (const mangle of [
    (s: string) => s.replace(/<!--[\s\S]*?-->/g, ""), // model ate the placeholders
    (s: string) => s.replace(/ data-correct="a"/g, ""), // model dropped a quiz marker
  ]) {
    const t = convexTest(schema, modules);
    const { topicId } = await seedCompleted(t, LESSON_DOC);
    await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
    stubGemini(mangle);

    await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

    const row = await t.run((ctx) =>
      ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", "lesson").eq("key", "0001-alpha")).unique(),
    );
    expect(row).toBeNull(); // skipped — the reader falls back to English
    const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job).toMatchObject({ status: "ready", done: 2, failed: 1 }); // title + mission landed
    vi.unstubAllGlobals();
  }
});

test("a full course translates every item via Gemini and publishes a ready Edition", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t);
  await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(["<p>terms</p>"], { type: "text/html" }));
    await ctx.db.insert("references", { topicId, key: "glossary", title: "Glossary", htmlStorageId: sid, contentHash: "h" });
  });
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 4, done: 0, failed: 0 }));
  stubGemini();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  const rows = await t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());
  expect(rows.map((r) => r.kind).sort()).toEqual(["lesson", "mission", "reference", "title"]);
  expect(rows.find((r) => r.kind === "lesson")?.html).toContain('data-correct="a"');
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job).toMatchObject({ status: "ready", done: 4 });
});

test("a Gemini failure reports failed (retryable) and leaves the English fallback", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t);
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream boom", { status: 500 })));

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("failed");
  const rows = await t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());
  expect(rows).toHaveLength(0);
});
