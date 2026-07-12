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
  await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(['<div class="quiz" data-correct="a"><div class="opts"><button class="opt" data-k="a">x</button></div></div>'], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-alpha", seq: 1, title: "Alpha", htmlStorageId: sid });
  });
  return { alice, topicId };
}

test("startTranslation always schedules the Gemini translate action (never POSTs), for BOTH providers", async () => {
  for (const provider of ["openrouter", undefined] as const) {
    const t = convexTest(schema, modules);
    const { alice, topicId } = await seedCompleted(t, provider);
    const { calls } = stubEcho(); // must NOT be called during the fire (no synchronous POST)

    // TRANSLATE_FIRE_URL is unset — the old Claude POST path would fire-error. Both
    // a Claude-authored (no provider) and an OpenRouter course must instead schedule
    // the Gemini action and succeed.
    const res = await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es" });
    expect(res).toMatchObject({ fired: true });
    expect(calls).toBe(0);

    const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job?.status).toBe("translating"); // lock held until the scheduled run reports
  }
});

test("translateTopic translates every item via Gemini and publishes a ready Edition", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(["<p>terms</p>"], { type: "text/html" }));
    await ctx.db.insert("references", { topicId, key: "glossary", title: "Glossary", htmlStorageId: sid, contentHash: "h" });
  });
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

test("a stale translating job (dead run, no heartbeat) can be re-fired, resuming — not restarting — the count", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  // A prior run published the title, then was killed infra-side: the job sits
  // "translating" forever because nothing ever reported (the prod 28/59 incident).
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  await t.mutation(api.translate.publishTranslation, {
    secret: "test-secret",
    ownerEmail: "alice@example.com",
    topicSlug: "greek",
    lang: "es",
    kind: "title",
    key: "",
    text: "Griego Koiné",
  });
  // Age the heartbeat past staleness so the lock reads dead.
  await t.run(async (ctx) => {
    const job = await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique();
    await ctx.db.patch(job!._id, { claimedAt: Date.now() - 11 * 60 * 1000 });
  });

  const res = await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es" });
  expect(res).toMatchObject({ fired: true });

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job?.status).toBe("translating");
  expect(job?.total).toBe(3); // title + mission + lesson
  expect(job?.done).toBe(1); // the fresh title translation survives as progress
});

test("a resumed run translates only the stale items — fresh rows are kept, not re-translated", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(["<p>beta body</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0002-beta", seq: 2, title: "Beta", htmlStorageId: sid });
  });
  // A prior (killed) run already published the title and the first lesson.
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 4, done: 0, failed: 0 }));
  const publish = { secret: "test-secret", ownerEmail: "alice@example.com", topicSlug: "greek", lang: "es" };
  await t.mutation(api.translate.publishTranslation, { ...publish, kind: "title", key: "", text: "Griego Koiné" });
  await t.mutation(api.translate.publishTranslation, { ...publish, kind: "lesson", key: "0001-alpha", title: "Alfa", html: "<p>ya</p>" });
  const gemini = stubEcho();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  // Only the stale items hit Gemini: mission (1 call) + lesson 0002 (title + body = 2).
  expect(gemini.calls).toBe(3);
  const rows = await t.run((ctx) => ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect());
  expect(rows.find((r) => r.kind === "lesson" && r.key === "0001-alpha")?.title).toBe("Alfa"); // untouched
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job).toMatchObject({ status: "ready", done: 4, failed: 0 });
});

test("a long course is translated in chunks — one invocation does at most a chunk, then reschedules itself to finish", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const { topicId } = await seedCompleted(t, "openrouter");
    // 7 items (title + mission + 5 lessons) — more than one chunk of 5.
    await t.run(async (ctx) => {
      for (let i = 2; i <= 5; i++) {
        const sid = await ctx.storage.store(new Blob([`<p>body ${i}</p>`], { type: "text/html" }));
        await ctx.db.insert("lessons", { topicId, key: `000${i}-x`, seq: i, title: `L${i}`, htmlStorageId: sid });
      }
    });
    await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 7, done: 0, failed: 0 }));
    stubEcho();

    await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

    // One invocation stops at its chunk — the action ceiling is what killed the
    // 59-item prod run — leaving the job mid-flight for the continuation.
    let job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job).toMatchObject({ status: "translating", done: 5 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job).toMatchObject({ status: "ready", done: 7, failed: 0 });
  } finally {
    vi.useRealTimers();
  }
});

test("a live translating job (recent heartbeat) still refuses a re-fire", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 1, failed: 0, claimedAt: Date.now() }),
  );
  await expect(asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es" })).rejects.toThrow(
    /already in progress/,
  );
});

test("each published item bumps the job heartbeat, so a live run keeps its lock", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  // The heartbeat is old (a long-running but alive run) — the next publish must refresh it.
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0, claimedAt: Date.now() - 11 * 60 * 1000 }),
  );
  await t.mutation(api.translate.publishTranslation, {
    secret: "test-secret",
    ownerEmail: "alice@example.com",
    topicSlug: "greek",
    lang: "es",
    kind: "title",
    key: "",
    text: "Griego Koiné",
  });
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(Date.now() - (job?.claimedAt ?? 0)).toBeLessThan(60_000);
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
