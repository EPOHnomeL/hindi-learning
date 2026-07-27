/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { itemHash, swapBackStatic, swapOutStatic } from "./translate";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});
beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  // This file exercises the OpenRouter (rollback) translate path — its stubs and
  // assertions speak the OpenRouter chat-completions wire shape (messages[],
  // reasoning, choices[]). The DEFAULT provider is now native Gemini
  // (translate-gemini.test.ts); pin this suite to the fallback explicitly.
  process.env.TRANSLATE_PROVIDER = "openrouter";
});
afterEach(() => {
  delete process.env.TRANSLATE_PROVIDER;
  vi.unstubAllGlobals();
});

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

// ---- Static-block placeholder swap (translation-cost 01) --------------------

// A realistic lesson document: styles in the head, quiz markup in the body,
// scripts at the foot — the shape every published Lesson blob has.
const LESSON_DOC = `<!doctype html><html><head><meta charset="utf-8"><title>Alpha</title><style>.quiz{color:red}</style></head><body><h1>Read this</h1><div class="quiz" data-correct="a"><button class="opt" data-k="a">yes</button></div><script>var boiler=1;</script><script src="./foot.js"></script></body></html>`;

test("swapOutStatic strips every style/script into placeholders; swapBackStatic restores them verbatim", () => {
  const { stripped, blocks } = swapOutStatic(LESSON_DOC);
  expect(blocks).toHaveLength(3);
  expect(stripped).not.toContain("color:red");
  expect(stripped).not.toContain("var boiler=1");
  expect(stripped).toContain("Read this"); // the prose still goes to the translator
  expect(stripped).toContain("data-correct"); // quiz markers ride through for the guard
  expect(swapBackStatic(stripped, blocks)).toBe(LESSON_DOC); // untouched round-trip is identity

  // A "translation" that only touched prose reassembles with the originals intact.
  const translated = stripped.replace("Read this", "Lees dit").replace(">yes<", ">ja<");
  const out = swapBackStatic(translated, blocks);
  expect(out).toContain("Lees dit");
  expect(out).toContain("<style>.quiz{color:red}</style>");
  expect(out).toContain("var boiler=1");
});

test("swapBackStatic refuses a dropped, duplicated, or invented placeholder", () => {
  const { stripped, blocks } = swapOutStatic(LESSON_DOC);
  const ph = stripped.match(/<!--[^>]*?0[^>]*?-->/)?.[0];
  expect(ph).toBeTruthy();
  expect(swapBackStatic(stripped.replace(ph!, ""), blocks)).toBeNull(); // dropped
  expect(swapBackStatic(stripped + ph!, blocks)).toBeNull(); // duplicated
  expect(swapBackStatic(stripped.replace(ph!, ph!.replace("0", "9")), blocks)).toBeNull(); // invented
});

test("the translate run sends bodies without style/script and publishes them restored", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  // Replace the seed lesson's blob with the boilerplate-rich document.
  await t.run(async (ctx) => {
    const lesson = await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001-alpha")).unique();
    const sid = await ctx.storage.store(new Blob([LESSON_DOC], { type: "text/html" }));
    await ctx.db.patch(lesson!._id, { htmlStorageId: sid });
  });
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      sent.push(body.messages[1].content as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: body.messages[1].content } }] }), { status: 200 });
    }),
  );

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  // No request carried the boilerplate — that's the token cut.
  for (const s of sent) {
    expect(s).not.toContain("color:red");
    expect(s).not.toContain("var boiler=1");
  }
  // The published row carries the fully restored document.
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
    const { topicId } = await seedCompleted(t, "openrouter");
    await t.run(async (ctx) => {
      const lesson = await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001-alpha")).unique();
      const sid = await ctx.storage.store(new Blob([LESSON_DOC], { type: "text/html" }));
      await ctx.db.patch(lesson!._id, { htmlStorageId: sid });
    });
    await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const content = body.messages[1].content as string;
        const isHtml = (body.messages[0].content as string).includes("HTML");
        return new Response(JSON.stringify({ choices: [{ message: { content: isHtml ? mangle(content) : content } }] }), { status: 200 });
      }),
    );

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

test("translation calls disable model reasoning — thinking tokens are pure cost here", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 0, failed: 0 }));
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      bodies.push(body);
      return new Response(JSON.stringify({ choices: [{ message: { content: body.messages[1].content } }] }), { status: 200 });
    }),
  );

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(b.reasoning).toEqual({ effort: "none" });
});

// ---- Edition title & mission edit (edition-title-edit 01) -------------------

async function titleRow(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, kind: "title" | "mission") {
  return await t.run((ctx) =>
    ctx.db.query("translations").withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "es").eq("kind", kind).eq("key", "")).unique(),
  );
}

test("owner edits an edition's title and mission in place; blank reverts to auto", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");

  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "Griego Koiné" });
  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "mission", text: "Lee el NT griego." });
  expect((await titleRow(t, topicId, "title"))?.text).toBe("Griego Koiné");
  expect((await titleRow(t, topicId, "mission"))?.text).toBe("Lee el NT griego.");

  // Editing again overwrites (update path)…
  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "Griego" });
  expect((await titleRow(t, topicId, "title"))?.text).toBe("Griego");
  // …and blank deletes the row — the reader falls back to the English source.
  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "  " });
  expect(await titleRow(t, topicId, "title")).toBeNull();
});

test("edit rights: that edition's Editor may edit; viewer, other-edition editor, the source lang, and guests are refused", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedCompleted(t, "openrouter");
  const editor = await t.run((ctx) => ctx.db.insert("users", { email: "ed@example.com" }));
  const viewer = await t.run((ctx) => ctx.db.insert("users", { email: "view@example.com" }));
  const frEditor = await t.run((ctx) => ctx.db.insert("users", { email: "fr@example.com" }));
  await t.run(async (ctx) => {
    await ctx.db.insert("shares", { topicId, viewerId: editor, lang: "es", role: "editor" });
    await ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "es" });
    await ctx.db.insert("shares", { topicId, viewerId: frEditor, lang: "fr", role: "editor" });
  });

  await asUser(t, editor).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "Griego (ed)" });
  expect((await titleRow(t, topicId, "title"))?.text).toBe("Griego (ed)");

  await expect(asUser(t, viewer).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "x" })).rejects.toThrow();
  await expect(asUser(t, frEditor).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "x" })).rejects.toThrow();
  await expect(asUser(t, editor).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "en", kind: "title", text: "x" })).rejects.toThrow();
  await expect(t.mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "x" })).rejects.toThrow();
});

test("a hand-edited title survives a re-translate (fresh via sourceHash — no Gemini call for it)", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "Griego curado" });
  await t.run((ctx) => ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 3, done: 1, failed: 0 }));
  const gemini = stubEcho();

  await t.action(internal.translate.translateTopic, { topicSlug: "greek", lang: "es" });

  // Only mission (1) + lesson title/body (2) hit Gemini — the curated title is skipped.
  expect(gemini.calls).toBe(3);
  expect((await titleRow(t, topicId, "title"))?.text).toBe("Griego curado");
  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job).toMatchObject({ status: "ready", done: 3, failed: 0 });
});

test("a mission edit on a course with no mission is refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "bare", title: "Bare", status: "completed" }));
  await expect(asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "bare", lang: "es", kind: "mission", text: "x" })).rejects.toThrow();
});

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

// ---- Engine picker: free fire, gemini schedule, forced redo -----------------

test("collectForTranslation: force returns already-fresh items; unforced skips them", async () => {
  const t = convexTest(schema, modules);
  const { alice } = await seedCompleted(t, "openrouter");
  // A hand-edit stamps the current source hash → the title reads fresh.
  await asUser(t, alice).mutation(api.translate.editEditionText, { topicSlug: "greek", lang: "es", kind: "title", text: "Griego" });

  const unforced = await t.query(internal.translate.collectForTranslation, { topicSlug: "greek", lang: "es" });
  expect(unforced!.items.some((i) => i.kind === "title")).toBe(false); // fresh → skipped

  const forced = await t.query(internal.translate.collectForTranslation, { topicSlug: "greek", lang: "es", force: true });
  expect(forced!.items.some((i) => i.kind === "title")).toBe(true); // force → returned anyway
});

test("startTranslation free engine POSTs the translate Routine and does NOT schedule the action", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  process.env.TRANSLATE_FIRE_URL = "https://routine.example/fire";
  process.env.TRANSLATE_FIRE_TOKEN = "tok";
  const posts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { posts.push(url); return new Response("{}", { status: 200 }); }));
  try {
    const res = await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es", engine: "free" });
    expect(res).toMatchObject({ fired: true });
    expect(posts).toEqual(["https://routine.example/fire"]); // fired the routine, nothing else

    const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job).toMatchObject({ status: "translating", engine: "free" }); // lock held for the cloud run to report
  } finally {
    delete process.env.TRANSLATE_FIRE_URL;
    delete process.env.TRANSLATE_FIRE_TOKEN;
  }
});

test("startTranslation free engine with unset TRANSLATE_FIRE env releases the lock and errors", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await seedCompleted(t, "openrouter");
  delete process.env.TRANSLATE_FIRE_URL;
  delete process.env.TRANSLATE_FIRE_TOKEN;

  await expect(
    asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es", engine: "free" }),
  ).rejects.toThrow(/free translation not configured/);

  const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
  expect(job).toMatchObject({ status: "failed" }); // the fire never landed → lock released
});

test("a free-translated ready edition re-translated with gemini redoes every item (forced switch)", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const { alice, topicId } = await seedCompleted(t, "openrouter");
    // A prior FREE run produced a fresh title (its sourceHash matches the source).
    await t.run(async (ctx) => {
      await ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 3, done: 3, failed: 0, engine: "free" });
      await ctx.db.insert("translations", { topicId, lang: "es", kind: "title", key: "", text: "FREE title", sourceHash: itemHash("title", { text: "Koine Greek" }) });
    });
    stubEcho();

    // free → gemini is an engine switch → forced: even the fresh title is redone.
    await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es", engine: "gemini" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const title = await titleRow(t, topicId, "title");
    expect(title?.text).toBe("Koine Greek"); // echo overwrote the fresh free title
    const job = await t.run((ctx) => ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique());
    expect(job).toMatchObject({ status: "ready", engine: "gemini", done: 3 });
  } finally {
    vi.useRealTimers();
  }
});

test("gemini → gemini re-translate only redoes stale items (resume, not forced)", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const { alice, topicId } = await seedCompleted(t, "openrouter");
    // A prior GEMINI run produced a fresh title.
    await t.run(async (ctx) => {
      await ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 3, done: 3, failed: 0, engine: "gemini" });
      await ctx.db.insert("translations", { topicId, lang: "es", kind: "title", key: "", text: "kept title", sourceHash: itemHash("title", { text: "Koine Greek" }) });
    });
    stubEcho();

    await asUser(t, alice).action(api.translate.startTranslation, { topicSlug: "greek", lang: "es", engine: "gemini" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const title = await titleRow(t, topicId, "title");
    expect(title?.text).toBe("kept title"); // same engine → fresh title skipped, not redone
  } finally {
    vi.useRealTimers();
  }
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
