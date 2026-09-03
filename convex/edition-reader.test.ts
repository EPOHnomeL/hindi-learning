/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { loadEdition } from "./lib";
import { SOURCE_LANG } from "./sourceLang";
import type { Doc, Id } from "./_generated/dataModel";

// The Edition reader (edition-deepening/01): the "translated row else English
// source" projection lives ONCE, in lib.loadEdition. These tests pin the fallback
// ladder and the decode rule the scattered call sites used to each re-implement.

const modules = import.meta.glob("./**/*.ts");

async function seedTopic(t: ReturnType<typeof convexTest>, title: string, mission?: string) {
  return await t.run((ctx) =>
    ctx.db.insert("topics", { slug: "t", title, ...(mission ? { mission } : {}) }),
  );
}

async function tr(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  lang: string,
  kind: "lesson" | "reference" | "mission" | "title" | "question",
  key: string,
  fields: { title?: string; text?: string; reply?: string; html?: string },
) {
  await t.run((ctx) => ctx.db.insert("translations", { topicId, lang, kind, key, sourceHash: "h", ...fields }));
}

const getTopic = (t: ReturnType<typeof convexTest>, id: Id<"topics">) =>
  t.run((ctx) => ctx.db.get(id)) as Promise<Doc<"topics">>;

test("source language: title/mission fall back to the topic, no translations consulted", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "Maps &amp; Lists", "Learn &amp; grow");
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const ed = loadEdition(ctx, topic, SOURCE_LANG);
    expect(await ed.title()).toBe("Maps & Lists"); // decoded
    expect(await ed.mission()).toBe("Learn & grow"); // decoded
  });
});

test("mission() is null when the topic has no mission", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "T");
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    expect(await loadEdition(ctx, topic, SOURCE_LANG).mission()).toBeNull();
    expect(await loadEdition(ctx, topic, "es").mission()).toBeNull();
  });
});

test("title()/mission(): translated row wins and is decoded; missing row falls back to source", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "Source Title", "Source Mission");
  await tr(t, id, "es", "title", "", { text: "Título &amp; más" });
  // no mission translation → falls back to source mission
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const ed = loadEdition(ctx, topic, "es");
    expect(await ed.title()).toBe("Título & más");
    expect(await ed.mission()).toBe("Source Mission");
  });
});

test("lesson(): translated title + inline body; falls back to source title and source blob", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "T");
  const srcBlob = await t.run((ctx) => ctx.storage.store(new Blob(["<p>src</p>"], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: id, key: "0001", seq: 1, title: "Src L1", htmlStorageId: srcBlob }));
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: id, key: "0002", seq: 2, title: "Src &amp; L2", htmlStorageId: srcBlob }));
  await tr(t, id, "es", "lesson", "0001", { title: "Trad L1", html: "<p>trad</p>" });
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const ed = loadEdition(ctx, topic, "es");
    const l1 = await ed.lesson((await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "0001")).unique())!);
    expect(l1.title).toBe("Trad L1");
    expect(l1.body).toEqual({ html: "<p>trad</p>" });
    const l2 = await ed.lesson((await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "0002")).unique())!);
    expect(l2.title).toBe("Src & L2"); // source title, decoded
    expect(l2.body).toEqual({ contentUrl: expect.stringContaining(String(srcBlob)) }); // source blob
  });
});

test("reference(): same translated-else-source projection as lesson()", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "T");
  const blob = await t.run((ctx) => ctx.storage.store(new Blob(["<p>r</p>"], { type: "text/html" })));
  await t.run((ctx) => ctx.db.insert("references", { topicId: id, key: "glossary", title: "Glossary", htmlStorageId: blob, contentHash: "c" }));
  await tr(t, id, "es", "reference", "glossary", { title: "Glosario" });
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const ref = (await ctx.db.query("references").withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "glossary")).unique())!;
    const r = await loadEdition(ctx, topic, "es").reference(ref);
    expect(r.title).toBe("Glosario");
    expect(r.body).toEqual({ contentUrl: expect.stringContaining(String(blob)) }); // untranslated body → source blob
  });
});

test("map(): one collect backs list titles (decoded) and question text (raw)", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "Src Title");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: id, key: "0001", seq: 1, title: "Src L1" }));
  const ref = { topicId: id, key: "g", title: "Src &amp; Ref", contentHash: "c" };
  await t.run((ctx) => ctx.db.insert("references", ref));
  const qid = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { email: "a@b.c" });
    // Source question HAS a reply — the translated reply is only surfaced when the
    // source has one (preserved from the original myQuestions/publicCourse rule).
    return await ctx.db.insert("questions", { userId: uid, topicId: id, lessonKey: "0001", text: "Src Q", status: "answered", reply: "Src R" });
  });
  await tr(t, id, "es", "title", "", { text: "Título" });
  await tr(t, id, "es", "lesson", "0001", { title: "Trad &amp; L1" });
  await tr(t, id, "es", "question", qid, { text: "Q &amp; A", reply: "R &amp; R" });
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const lesson = (await ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "0001")).unique())!;
    const reference = (await ctx.db.query("references").withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "g")).unique())!;
    const question = (await ctx.db.get(qid))!;
    const m = await loadEdition(ctx, topic, "es").map(["title", "lesson", "reference", "question"]);
    expect(m.title(topic)).toBe("Título");
    expect(m.lessonTitle(lesson)).toBe("Trad & L1"); // decoded
    expect(m.referenceTitle(reference)).toBe("Src & Ref"); // untranslated → source, decoded
    const q = m.question(question);
    expect(q.text).toBe("Q &amp; A"); // NOT decoded
    expect(q.reply).toBe("R &amp; R"); // NOT decoded
  });
});

test("map().question(): a translated reply is suppressed when the source question has none", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "T");
  const qid = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { email: "a@b.c" });
    return await ctx.db.insert("questions", { userId: uid, topicId: id, lessonKey: "0001", text: "Q", status: "open" });
  });
  await tr(t, id, "es", "question", qid, { text: "Trad Q", reply: "Trad R" });
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const question = (await ctx.db.get(qid))!;
    const q = (await loadEdition(ctx, topic, "es").map(["question"])).question(question);
    expect(q.text).toBe("Trad Q");
    expect(q.reply).toBeNull(); // source has no reply → translated reply withheld
  });
});

// The cost guarantee (Jul 8 – Aug 7 2026 bill): a snapshot must read ONLY the
// kinds its caller declared. `lesson`/`reference` rows carry a whole inline HTML
// body, so a list query that over-declares silently pays for every lesson body
// in the Edition — that was 95% of that month's Database I/O. There is no I/O
// counter to assert on in convex-test, so we pin the guard that makes
// over-reading impossible to do by accident instead: an undeclared kind throws
// rather than falling back to the source text (which would look like a missing
// translation, not a bug).
test("map(): reading a kind that was not requested throws, it does not fall back", async () => {
  const t = convexTest(schema, modules);
  const id = await seedTopic(t, "T");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: id, key: "0001", seq: 1, title: "Src L1" }));
  await tr(t, id, "es", "lesson", "0001", { title: "Trad L1" });
  const topic = await getTopic(t, id);
  await t.run(async (ctx) => {
    const lesson = (await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", id).eq("key", "0001"))
      .unique())!;
    const questionsOnly = await loadEdition(ctx, topic, "es").map(["question"]);
    expect(() => questionsOnly.lessonTitle(lesson)).toThrow(/not requested/);
    // ...and the kind it DID declare still resolves.
    const lessonsOnly = await loadEdition(ctx, topic, "es").map(["lesson"]);
    expect(lessonsOnly.lessonTitle(lesson)).toBe("Trad L1");
  });
});
