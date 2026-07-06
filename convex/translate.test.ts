/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Course translation (Editions). An Edition = (Topic, language) is the unit of
// access: the owner holds English + every ready translation; a Viewer holds only
// the languages shared to them; a Guest holds the token's Edition. The reader
// serves translated content when the caller holds the requested language, and
// falls back to the English source per item otherwise. Tested at the Convex seam
// — the actual Claude call (translateItem) is out of band, so these seed
// `translations` rows directly to stand in for a completed translation.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(
  t: ReturnType<typeof convexTest>,
  ownerId: Id<"users">,
  slug: string,
  title: string,
  status: "active" | "completed" = "completed",
) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status }));
}
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number) {
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, html: `<p>en ${key}</p>` }));
}
// Stand in for a completed translation of one item.
async function addTranslation(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  lang: string,
  kind: "lesson" | "reference" | "mission" | "title" | "question",
  key: string,
  fields: { title?: string; html?: string; text?: string; reply?: string },
) {
  await t.run((ctx) => ctx.db.insert("translations", { topicId, lang, kind, key, sourceHash: "h", ...fields }));
}
async function addReadyJob(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 }),
  );
}
async function share(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, viewerId: Id<"users">, lang?: string) {
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId, lang }));
}

// ---- Reader: Edition gating + per-item fallback ----------------------------

test("owner reads a translated Edition; unheld languages fall back to English", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección 0001", html: "<p>es 0001</p>" });

  const a = asUser(t, alice);
  // Spanish edition (the owner holds it — a ready job exists).
  expect(await a.query(api.content.getLesson, { topicSlug: "hindi", key: "0001", lang: "es" })).toMatchObject({
    title: "Lección 0001",
    html: "<p>es 0001</p>",
  });
  expect(await a.query(api.content.listLessons, { topicSlug: "hindi", lang: "es" })).toEqual([
    { key: "0001", seq: 1, title: "Lección 0001" },
  ]);
  // English (source) is always available and returns the base rows.
  expect(await a.query(api.content.getLesson, { topicSlug: "hindi", key: "0001", lang: "en" })).toMatchObject({
    html: "<p>en 0001</p>",
  });
  // A language with no Edition (fr) isn't held → falls back to English, never 403s.
  expect(await a.query(api.content.getLesson, { topicSlug: "hindi", key: "0001", lang: "fr" })).toMatchObject({
    html: "<p>en 0001</p>",
  });
});

test("a per-item missing translation falls back to the English source", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección 0001", html: "<p>es 0001</p>" });
  // 0002 has no Spanish row → English fallback.
  expect(await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "es" })).toMatchObject({
    html: "<p>en 0002</p>",
  });
});

test("courseHeader exposes only the Editions the caller holds", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addReadyJob(t, topicId, "ur");

  // Owner holds English + every ready translation.
  const ownerHdr = await asUser(t, alice).query(api.content.courseHeader, { topicSlug: "hindi" });
  expect(ownerHdr!.editions.map((e) => e.lang).sort()).toEqual(["en", "es", "ur"]);

  // A Viewer shared only Urdu holds ONLY Urdu — and Urdu is RTL.
  await share(t, topicId, bob, "ur");
  const bobHdr = await asUser(t, bob).query(api.content.courseHeader, { topicSlug: "hindi", lang: "ur" });
  expect(bobHdr!.editions.map((e) => e.lang)).toEqual(["ur"]);
  expect(bobHdr!.lang).toBe("ur");
  expect(bobHdr!.dir).toBe("rtl");
  // Bob asking for Spanish (not shared to him) can't self-serve it — he gets the
  // only Edition he holds, Urdu.
  const bobEn = await asUser(t, bob).query(api.content.courseHeader, { topicSlug: "hindi", lang: "es" });
  expect(bobEn!.lang).toBe("ur");
});

// ---- startTranslation: owner + completed gate ------------------------------

test("startTranslation is owner-only and completed-only, and seeds a job", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const activeId = await seedTopic(t, alice, "active-course", "Active", "active");
  await addLesson(t, activeId, "0001", 1);

  // Not completed → refused.
  await expect(
    asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "active-course", lang: "es" }),
  ).rejects.toThrow(/completed/);

  const doneId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, doneId, "0001", 1);
  // A non-owner can't translate someone else's course.
  await expect(
    asUser(t, bob).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "es" }),
  ).rejects.toThrow(/not found/);
  // Can't translate into the source language.
  await expect(
    asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "en" }),
  ).rejects.toThrow(/source language/);

  // Owner + completed → schedules the title + the one lesson, seeds the job.
  const res = await asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "es" });
  expect(res).toEqual({ total: 2, scheduled: 2 });
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", doneId).eq("lang", "es")).unique(),
  );
  expect(job).toMatchObject({ status: "translating", total: 2, done: 0 });
});

test("startTranslation refuses an unsupported language (bounds Edition fan-out + junk codes)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  // A non-menu / junk code is rejected before any job is seeded or work scheduled,
  // so an owner can't spawn unbounded billable Editions from arbitrary strings.
  await expect(
    asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "x1" }),
  ).rejects.toThrow(/unsupported language/);
  const job = await t.run((ctx) =>
    ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "x1")).unique(),
  );
  expect(job).toBeNull();
});

test("startTranslation refuses to re-run while a job is still translating (no double-schedule)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  const first = await asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "es" });
  expect(first.scheduled).toBeGreaterThan(0); // job is now "translating", items in flight
  // A second run before the tail lands is refused — otherwise in-flight items are
  // re-scheduled (double-billed) and the job can flip "ready" while incomplete.
  await expect(
    asUser(t, alice).mutation(api.translate.startTranslation, { topicSlug: "hindi", lang: "es" }),
  ).rejects.toThrow(/in progress/);
});

test("editions lists English + each job with share counts", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await share(t, topicId, bob, "es");

  const eds = await asUser(t, alice).query(api.translate.editions, { topicSlug: "hindi" });
  expect(eds!.completed).toBe(true);
  const en = eds!.editions.find((e) => e.lang === "en")!;
  expect(en).toMatchObject({ source: true, status: "ready" });
  const es = eds!.editions.find((e) => e.lang === "es")!;
  expect(es).toMatchObject({ source: false, status: "ready", shareCount: 1 });
  // A Viewer isn't the owner → no Editions panel.
  expect(await asUser(t, bob).query(api.translate.editions, { topicSlug: "hindi" })).toBeNull();
});

// ---- Per-edition sharing + public links ------------------------------------

test("shareTopic grants one Edition; a Viewer of a non-ready language is refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección", html: "<p>es</p>" });

  // Sharing a language with no ready Edition is refused.
  await expect(
    asUser(t, alice).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "bob@example.com", lang: "fr" }),
  ).rejects.toThrow(/isn't ready/);

  // Sharing the Spanish Edition grants Bob exactly Spanish.
  expect(
    await asUser(t, alice).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "bob@example.com", lang: "es" }),
  ).toBe("shared");
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0001", lang: "es" })).toMatchObject({
    html: "<p>es</p>",
  });
  // Bob shows up in "Shared with me" holding the Spanish Edition.
  const shared = await asUser(t, bob).query(api.shares.listSharedTopics, {});
  expect(shared[0]!.langs.map((l) => l.lang)).toEqual(["es"]);
});

test("setEditionPublic refuses a non-English edition that isn't ready, but always allows revoke", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  // No ready Spanish Edition → publishing a Spanish link (which would just serve
  // English under an "es" label) is refused, mirroring shareTopic.
  await expect(
    asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true }),
  ).rejects.toThrow(/isn't ready/);
  // Once the Edition is ready, publishing mints a token.
  await addReadyJob(t, topicId, "es");
  const token = await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true });
  expect(typeof token).toBe("string");
  // Revoking never requires readiness — cleanup must always work.
  expect(
    await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: false }),
  ).toBeNull();
});

test("a per-Edition public link serves that language; a legacy token serves English", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await addTranslation(t, topicId, "es", "lesson", "0001", { title: "Lección", html: "<p>es</p>" });

  // Spanish public link (per-Edition) → the Guest reads Spanish.
  const esToken = await asUser(t, alice).mutation(api.shares.setEditionPublic, {
    topicSlug: "hindi",
    lang: "es",
    isPublic: true,
  });
  const esCourse = await t.query(api.public.publicCourse, { token: esToken! });
  expect(esCourse).toMatchObject({ title: "Hindi (es)", lang: "es", dir: "ltr" });
  expect(esCourse!.lessons[0]).toMatchObject({ title: "Lección" });
  expect(await t.query(api.public.publicLesson, { token: esToken!, key: "0001" })).toMatchObject({ html: "<p>es</p>" });

  // The legacy per-Topic token (setTopicPublic) still resolves to English.
  const enToken = await asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  const enCourse = await t.query(api.public.publicCourse, { token: enToken! });
  expect(enCourse).toMatchObject({ title: "Hindi", lang: "en" });
  expect(await t.query(api.public.publicLesson, { token: enToken!, key: "0001" })).toMatchObject({ html: "<p>en 0001</p>" });
});

test("removeEdition drops the Edition's translations, job, shares, and public link", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await share(t, topicId, bob, "es");
  await asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true });

  await asUser(t, alice).mutation(api.translate.removeEdition, { topicSlug: "hindi", lang: "es" });

  const left = await t.run(async (ctx) => ({
    translations: (await ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect()).length,
    jobs: (await ctx.db.query("translationJobs").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).unique()) === null,
    links: (await ctx.db.query("publicLinks").withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "es")).collect()).length,
    shares: (await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topicId)).collect()).length,
  }));
  expect(left).toEqual({ translations: 0, jobs: true, links: 0, shares: 0 });
});

// ---- Certificate: Edition snapshot -----------------------------------------

test("a certificate snapshots the title + language of the Edition completed in", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addReadyJob(t, topicId, "es");
  await addTranslation(t, topicId, "es", "title", "", { text: "Hindi (es)" });
  await share(t, topicId, bob, "es");
  // Bob completes the one lesson.
  await t.run((ctx) => ctx.db.insert("progress", { userId: bob, topicId, lessonKey: "0001", status: "completed" }));

  const cert = await asUser(t, bob).mutation(api.certificates.claimCertificate, {
    topicSlug: "hindi",
    name: "Bob",
    lang: "es",
  });
  expect(cert).toMatchObject({ courseTitle: "Hindi (es)", lang: "es" });
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub).toMatchObject({ courseTitle: "Hindi (es)", lang: "es", dir: "ltr" });
});
