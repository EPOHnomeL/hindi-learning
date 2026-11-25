/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Public link shares (issue 07 / ADR 0013): an owner mints a Public link (token)
// and a Guest reads the Topic by token, with no account. Token-authorized reads
// live in convex/public.ts; the owner mutation is shares.setTopicPublic.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string, mission?: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status: "active", mission }));
}

test("an owner makes a Topic public; a Guest reads it by token, a wrong token gets nothing", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));

  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  expect(typeof token).toBe("string");

  // No identity — a true anonymous Guest reads the course by token.
  expect(await t.query(api.public.publicCourse, { token: token! })).toMatchObject({ title: "Hindi" });
  // A token that resolves to nothing reveals nothing.
  expect(await t.query(api.public.publicCourse, { token: "not-a-real-token" })).toBeNull();
});

test("publicCourse is the full mirror: lessons, references, resources, the owner's progress + Q&A", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B" });
    // A superseded lesson must not appear in the sidebar.
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", supersededBy: "0001-a" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", contentHash: "h" });
    await ctx.db.insert("resources", { topicId, ownerId: owner, filename: "Doc", url: "https://x", contentHash: "https://x", status: "ready", kind: "url" });
    await ctx.db.insert("progress", { userId: owner, topicId, lessonKey: "0001-a", status: "completed" });
    await ctx.db.insert("questions", { userId: owner, topicId, lessonKey: "0001-a", text: "why?", status: "answered", reply: "because" });
  });
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  expect(await t.query(api.public.publicCourse, { token: token! })).toMatchObject({
    title: "Hindi",
    lessons: [{ key: "0001-a", seq: 1 }, { key: "0002-b", seq: 2 }],
    references: [{ key: "grammar", title: "Grammar" }],
    resources: [{ filename: "Doc", url: "https://x", kind: "url" }],
    progress: [{ lessonKey: "0001-a", status: "completed" }],
    questions: [{ lessonKey: "0001-a", text: "why?", reply: "because" }],
  });
});

test("publicLesson and publicReference serve HTML by token; superseded/wrong key/wrong token get null", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  const { lessonSid, refSid } = await t.run(async (ctx) => {
    const lessonSid = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    const refSid = await ctx.storage.store(new Blob(["<p>ref</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", htmlStorageId: lessonSid });
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", supersededBy: "0001-a" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", htmlStorageId: refSid, contentHash: "h" });
    return { lessonSid, refSid };
  });
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  expect(await t.query(api.public.publicLesson, { token: token!, key: "0001-a" })).toMatchObject({ key: "0001-a", contentUrl: expect.stringContaining(`/content?id=${lessonSid}`) });
  expect(await t.query(api.public.publicReference, { token: token!, key: "grammar" })).toMatchObject({ key: "grammar", contentUrl: expect.stringContaining(`/content?id=${refSid}`) });

  expect(await t.query(api.public.publicLesson, { token: token!, key: "0000-old" })).toBeNull(); // superseded
  expect(await t.query(api.public.publicLesson, { token: "nope", key: "0001-a" })).toBeNull(); // wrong token
  expect(await t.query(api.public.publicReference, { token: token!, key: "missing" })).toBeNull(); // unknown key
});

test("setTopicPublic: regenerate invalidates the old token, make-private revokes, and it's owner-only", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));

  const t1 = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  const t2 = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true }); // regenerate
  expect(t2).not.toBe(t1);
  expect(await t.query(api.public.publicCourse, { token: t1! })).toBeNull(); // old link dead
  expect(await t.query(api.public.publicCourse, { token: t2! })).toMatchObject({ title: "Hindi" });

  const off = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: false });
  expect(off).toBeNull();
  expect(await t.query(api.public.publicCourse, { token: t2! })).toBeNull(); // revoked

  // A non-owner can't make someone else's Topic public.
  await expect(
    asUser(t, stranger).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true }),
  ).rejects.toThrow();
});

test("publicEditionLang reports the Edition a token serves, so a Guest gets chrome in that language", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));

  // The legacy per-Topic token is the English source Edition.
  const english = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  expect(await t.query(api.public.publicEditionLang, { token: english! })).toBe("en");

  // A per-language link reports its own language, no account needed.
  await t.run((ctx) => ctx.db.insert("publicLinks", { topicId, lang: "es", token: "spanish-token" }));
  expect(await t.query(api.public.publicEditionLang, { token: "spanish-token" })).toBe("es");

  // An unknown/revoked token reveals nothing, like the rest of the seam.
  expect(await t.query(api.public.publicEditionLang, { token: "not-a-real-token" })).toBeNull();
  expect(await t.query(api.public.publicEditionLang, { token: "" })).toBeNull();
});

test("the read seam is identity-agnostic: any signed-in user (and the owner) read a public Topic by token", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const someoneElse = await seedUser(t, "else@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  // No Share needed — the token alone grants the read, regardless of who's asking.
  expect(await asUser(t, someoneElse).query(api.public.publicCourse, { token: token! })).toMatchObject({ title: "Hindi" });
  // The owner opening their own share URL previews the same Guest view.
  expect(await asUser(t, owner).query(api.public.publicCourse, { token: token! })).toMatchObject({ title: "Hindi" });
});

// ---- The first-open welcome panel (welcome/01) -----------------------------
//
// The Guest reader's welcome needs two things the bundle didn't carry: the course
// mission (the "what is this for" line) and the course's tenant (its portal's
// front door — `/share/<token>` has no canonical-host bounce, so a Guest can be
// reading a tenanted course on the apex).

test("publicCourse carries the mission + the course's tenant, for the welcome panel", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", "Read Premchand in the original.");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  // Tenant the course after minting the link: whether a tenant may share publicly
  // at all is a feature-flag question owned by setTopicPublic's own tests — this one
  // is about what the Guest bundle projects.
  await t.run((ctx) => ctx.db.patch(topicId, { tenantSlug: "ywampotch" }));

  expect(await t.query(api.public.publicCourse, { token: token! })).toMatchObject({
    mission: "Read Premchand in the original.",
    tenantSlug: "ywampotch",
  });
});

test("publicCourse: a course with no mission and no tenant reports both as null", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  const pub = await t.query(api.public.publicCourse, { token: token! });
  expect(pub!.mission).toBeNull();
  expect(pub!.tenantSlug).toBeNull();
});

test("publicCourse serves the Edition's translated mission, falling back to English", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", "Read Premchand in the original.");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    // A per-language Public link fixes the Guest to one Edition (course-translation).
    await ctx.db.insert("publicLinks", { topicId, lang: "es", token: "tok-es" });
    await ctx.db.insert("publicLinks", { topicId, lang: "fr", token: "tok-fr" });
    // ...but only the Spanish Edition has the mission translated.
    await ctx.db.insert("translations", {
      topicId,
      lang: "es",
      kind: "mission",
      key: "",
      text: "Leer a Premchand en el original.",
      sourceHash: "h",
    });
  });

  expect((await t.query(api.public.publicCourse, { token: "tok-es" }))!.mission).toBe(
    "Leer a Premchand en el original.",
  );
  // French has no translated mission row yet — the English source stands in.
  expect((await t.query(api.public.publicCourse, { token: "tok-fr" }))!.mission).toBe(
    "Read Premchand in the original.",
  );
});

// Teacher Q&A (teacher-qa ticket 03): with the setting off the owner's Q&A is
// absent from the GUEST PAYLOAD, not merely hidden in the DOM. This is the second
// read path (the first is capture.myQuestions) and the reason the gate is server
// side at all: a client side hide would leave the owner's thread readable in
// devtools on a public, anonymous page.
test("publicCourse: Teacher Q&A off withholds the owner's questions from the payload", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("questions", { userId: owner, topicId, lessonKey: "0001-a", text: "why?", status: "answered", reply: "because" });
  });
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  // On (unset) the Guest sees the thread, as today.
  expect(await t.query(api.public.publicCourse, { token: token! })).toMatchObject({
    teacherQa: true,
    questions: [{ text: "why?", reply: "because" }],
  });

  await asUser(t, owner).mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: false });
  const off = await t.query(api.public.publicCourse, { token: token! });
  expect(off).toMatchObject({ teacherQa: false, questions: [] });
  // The lessons TOC and everything else the Guest reads is untouched.
  expect(off?.lessons).toMatchObject([{ key: "0001-a", seq: 1 }]);

  // Hidden, never destroyed: the rows are still there and come back on.
  expect(await t.run((ctx) => ctx.db.query("questions").collect())).toMatchObject([{ text: "why?" }]);
  await asUser(t, owner).mutation(api.capture.setTeacherQa, { topicSlug: "hindi", enabled: true });
  expect((await t.query(api.public.publicCourse, { token: token! }))?.questions).toMatchObject([{ text: "why?", reply: "because" }]);
});

// ---- The course poster (course-poster spec) --------------------------------
//
// The poster's footer prints "available in N languages" from the Edition's live
// siblings. "Live" is the publish grain (ADR 0024): a ready Edition that is
// reachable by a Public link or listed in the catalogue. Nothing here leaks past
// what the signed-in catalogue already shows.

test("publicCourse.languages lists the live Editions: ready, and public or published", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    // Three ready Editions besides English: Spanish and Urdu carry Public links,
    // Afrikaans is only listed in the catalogue.
    for (const lang of ["es", "ur", "af"]) {
      await ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 });
    }
    await ctx.db.insert("publicLinks", { topicId, lang: "es", token: "tok-es" });
    await ctx.db.insert("publicLinks", { topicId, lang: "ur", token: "tok-ur" });
    await ctx.db.insert("publishedEditions", { topicId, lang: "af", published: true });
    // A translating Edition is not an Edition yet, and a ready one nobody can
    // reach is not live.
    await ctx.db.insert("translationJobs", { topicId, lang: "fr", status: "translating", total: 3, done: 1, failed: 0 });
    await ctx.db.insert("publicLinks", { topicId, lang: "fr", token: "tok-fr" });
    await ctx.db.insert("translationJobs", { topicId, lang: "de", status: "ready", total: 1, done: 1, failed: 0 });
  });
  // The English source is live through the legacy per-Topic token.
  const english = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  const pub = await t.query(api.public.publicCourse, { token: english! });
  expect(pub!.languages).toEqual([
    { lang: "af", native: "Afrikaans" },
    { lang: "en", native: "English" },
    { lang: "es", native: "Español" },
    { lang: "ur", native: "اردو" },
  ]);
  // The same list from a sibling's token: it describes the course, not the link.
  expect((await t.query(api.public.publicCourse, { token: "tok-ur" }))!.languages).toHaveLength(4);
});

test("publicCourse.languages: an unreachable English source is not live, and a revoked token is still null", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 1, done: 1, failed: 0 });
    await ctx.db.insert("publicLinks", { topicId, lang: "es", token: "tok-es" });
  });
  // No English link and no English listing: only Spanish is live.
  expect((await t.query(api.public.publicCourse, { token: "tok-es" }))!.languages).toEqual([{ lang: "es", native: "Español" }]);

  const english = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });
  expect((await t.query(api.public.publicCourse, { token: english! }))!.languages).toHaveLength(2);
  await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: false });
  expect(await t.query(api.public.publicCourse, { token: english! })).toBeNull();
});

// ---- The slug entrance (2026-09-08, widened 2026-11-25) --------------------
// `/courses/<slug>` serves the same Guest reader with no token, for an Edition
// that is published AND (priced OR has its Public link on). Everything else
// stays behind sign-in.

async function publish(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang, published: true }));
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount: 19900, currency: "zar" }));
}

test("a published, priced course is readable by slug: the Preview opens, the rest is paygated", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  const sid = await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", htmlStorageId: sid });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B", htmlStorageId: sid });
    return sid;
  });
  await publish(t, topicId, "en");
  await price(t, topicId, "en");

  // No identity and no token: a stranger on the course's own URL.
  const course = await t.query(api.public.publicCourse, { slug: "hindi" });
  expect(course).toMatchObject({
    title: "Hindi",
    lang: "en",
    paywall: { amount: 19900, currency: "zar", previewKey: "0001-a" },
    lessons: [
      { key: "0001-a", locked: false },
      { key: "0002-b", locked: true },
    ],
  });

  // The free first Lesson serves its body; the next one is a locked marker.
  expect(await t.query(api.public.publicLesson, { slug: "hindi", key: "0001-a" })).toMatchObject({
    locked: false,
    contentUrl: expect.stringContaining(`/content?id=${sid}`),
  });
  expect(await t.query(api.public.publicLesson, { slug: "hindi", key: "0002-b" })).toMatchObject({ locked: true });
});

test("the slug entrance stays shut for a free, an unpublished and an unknown course", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));

  // Priced but never published: not a shopfront, so not public.
  await price(t, topicId, "en");
  expect(await t.query(api.public.publicCourse, { slug: "hindi" })).toBeNull();

  // Published but free with no Public link: the sign-in gate holds.
  await t.run(async (ctx) => {
    const listing = await ctx.db.query("listings").first();
    if (listing) await ctx.db.delete(listing._id);
  });
  await publish(t, topicId, "en");
  expect(await t.query(api.public.publicCourse, { slug: "hindi" })).toBeNull();

  expect(await t.query(api.public.publicCourse, { slug: "no-such-course" })).toBeNull();
  expect(await t.query(api.public.publicCourse, { slug: "" })).toBeNull();
  expect(await t.query(api.public.publicLesson, { slug: "hindi", key: "0001-a" })).toBeNull();
});

test("publicCourseLang reports the Edition the slug entrance serves, honouring an explicit ?lang", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 1, done: 1, failed: 0 });
  });
  await publish(t, topicId, "en");
  await publish(t, topicId, "es");
  await price(t, topicId, "en");
  await price(t, topicId, "es");

  // No preference lands on the English source Edition.
  expect(await t.query(api.public.publicCourseLang, { slug: "hindi" })).toBe("en");
  // An explicit request for a published Edition is honoured.
  expect(await t.query(api.public.publicCourseLang, { slug: "hindi", lang: "es" })).toBe("es");
  // An unpublished language falls back rather than 404ing the visitor.
  expect(await t.query(api.public.publicCourseLang, { slug: "hindi", lang: "ur" })).toBe("en");
  // A course with no public slug entrance offers no hint at all.
  expect(await t.query(api.public.publicCourseLang, { slug: "no-such-course" })).toBeNull();
});

test("a published free course with its Public link on reads in full by slug, and the link says so", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  const sid = await t.run(async (ctx) => {
    const sid = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", htmlStorageId: sid });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B", htmlStorageId: sid });
    await ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 2, done: 2, failed: 0 });
    return sid;
  });
  const as = asUser(t, owner);
  const token = (await as.mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "en", isPublic: true }))!;

  // Public link on but not published: the slug stays shut and the link is the token one.
  expect(await t.query(api.public.publicCourse, { slug: "hindi" })).toBeNull();
  expect((await t.query(api.public.publicCourse, { token }))?.path).toBe(`/share/${token}`);

  // Published + free + public: every Lesson opens on the course's own URL.
  await publish(t, topicId, "en");
  const course = await t.query(api.public.publicCourse, { slug: "hindi" });
  expect(course).toMatchObject({ lang: "en", path: "/courses/hindi", lessons: [{ locked: false }, { locked: false }] });
  expect(course?.paywall).toBeUndefined();
  expect(await t.query(api.public.publicLesson, { slug: "hindi", key: "0002-b" })).toMatchObject({
    contentUrl: expect.stringContaining(`/content?id=${sid}`),
  });
  // Every surface that hands out the link now hands out the readable one.
  expect((await t.query(api.public.publicCourse, { token }))?.path).toBe("/courses/hindi");
  expect((await as.query(api.content.reader.courseHeader, { topicSlug: "hindi" }))?.publicLink?.path).toBe("/courses/hindi");

  // A translated Edition carries its language on the readable URL.
  await publish(t, topicId, "es");
  const esToken = (await as.mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: true }))!;
  expect((await t.query(api.public.publicCourse, { token: esToken }))?.path).toBe("/courses/hindi?lang=es");
  expect(await t.query(api.public.publicCourseLang, { slug: "hindi", lang: "es" })).toBe("es");

  // Turning the Public link off shuts the slug again (es is still public, so ?lang=es stays open).
  await as.mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "en", isPublic: false });
  expect(await t.query(api.public.publicCourseLang, { slug: "hindi" })).toBe("es");
  await as.mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "es", isPublic: false });
  expect(await t.query(api.public.publicCourse, { slug: "hindi" })).toBeNull();
});
