/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Paid marketplace — Slice 1 (ADR 0016). The access resolver is the only new
// logic, so it's tested as a TRUTH TABLE across
//   (owner, viewer, entitled, preview, none) × (paid, free)
// for a requested Edition, exercised at the Convex reader seam (the PRD's rule:
// assert the access a caller GETS, never implementation detail). A paid Edition
// shows an unentitled caller only its Preview (the first non-superseded Lesson)
// plus the table of contents; every other Lesson/Reference is a `locked` marker,
// distinct from a not-found null. A free Edition is unchanged from
// course-translation. Entitlements are Edition-scoped: `es` never unlocks `ur`.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status: "completed" as const }));
}
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number) {
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob([`<p>en ${key}</p>`], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, htmlStorageId });
  });
}
async function share(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, viewerId: Id<"users">, lang?: string) {
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId, lang }));
}
async function entitle(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">, lang: string) {
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId, lang }));
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, amount: number, currency: string) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount, currency }));
}
async function publicLink(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, token: string) {
  await t.run((ctx) => ctx.db.insert("publicLinks", { topicId, lang, token }));
}

// Owner + two English Lessons; 0001 (lowest seq) is the Preview. `status` is
// completed (a paid Edition presupposes a finished course).
async function fixture(t: ReturnType<typeof convexTest>) {
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  return { alice, topicId };
}

// ---- free Edition: unchanged from course-translation ------------------------

test("free Edition — owner & Viewer read everything; a stranger is not-found", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await fixture(t);
  const bob = await seedUser(t, "bob@example.com");
  const carol = await seedUser(t, "carol@example.com");
  await share(t, topicId, bob); // legacy Share → English edition

  // owner: full, role owner, no paywall.
  const ownerHdr = await asUser(t, alice).query(api.content.courseHeader, { topicSlug: "hindi" });
  expect(ownerHdr).toMatchObject({ role: "owner", lang: "en" });
  expect(ownerHdr!.paywall).toBeUndefined();
  expect(await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });

  // Viewer: full, role viewer.
  expect(await asUser(t, bob).query(api.content.courseHeader, { topicSlug: "hindi" })).toMatchObject({ role: "viewer" });
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });

  // Stranger on a FREE Edition: not-found (null), never a Preview.
  expect(await asUser(t, carol).query(api.content.courseHeader, { topicSlug: "hindi" })).toBeNull();
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" })).toBeNull();
  expect(await asUser(t, carol).query(api.content.listLessons, { topicSlug: "hindi" })).toEqual([]);
});

// ---- paid Edition: the paygate ----------------------------------------------

test("paid Edition — owner, Viewer, and entitled buyer read everything", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await fixture(t);
  const bob = await seedUser(t, "bob@example.com");
  const dave = await seedUser(t, "dave@example.com");
  await price(t, topicId, "en", 500, "zar");
  await share(t, topicId, bob, "en");
  await entitle(t, topicId, dave, "en");

  // owner is never paywalled on their own course.
  expect(await asUser(t, alice).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
  expect((await asUser(t, alice).query(api.content.courseHeader, { topicSlug: "hindi" }))!.paywall).toBeUndefined();

  // language-scoped Viewer reads the whole Edition.
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });

  // entitled buyer ≡ Viewer: full read, reported as its own role.
  expect(await asUser(t, dave).query(api.content.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "entitled",
  });
  expect(await asUser(t, dave).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
});

test("paid Edition — an unentitled caller (signed-in or Guest) gets only the Preview", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  const carol = await seedUser(t, "carol@example.com");
  await price(t, topicId, "en", 500, "zar");
  await publicLink(t, topicId, "en", "tok-en");

  // Signed-in non-holder: role preview + the paygate (price + which Lesson is free).
  const hdr = await asUser(t, carol).query(api.content.courseHeader, { topicSlug: "hindi" });
  expect(hdr).toMatchObject({ role: "preview", lang: "en", paywall: { amount: 500, currency: "zar", previewKey: "0001" } });
  // The whole table of contents still renders (the paygate has structure).
  expect((await asUser(t, carol).query(api.content.listLessons, { topicSlug: "hindi" })).map((l) => l.key)).toEqual([
    "0001",
    "0002",
  ]);
  // The Preview Lesson's body is served; every other Lesson is locked (not null).
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    html: "",
    locked: true,
  });

  // Guest via a Public link to the paid Edition: the same paygate.
  const pub = await t.query(api.public.publicCourse, { token: "tok-en" });
  expect(pub).toMatchObject({ paywall: { amount: 500, currency: "zar", previewKey: "0001" } });
  expect(pub!.lessons.map((l) => l.key)).toEqual(["0001", "0002"]); // TOC intact
  expect(pub!.resources).toEqual([]); // paid material withheld
  expect(await t.query(api.public.publicLesson, { token: "tok-en", key: "0001" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
  expect(await t.query(api.public.publicLesson, { token: "tok-en", key: "0002" })).toMatchObject({
    html: "",
    locked: true,
  });
});

test("a Guest on a FREE Public link still reads everything (unchanged)", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  await publicLink(t, topicId, "en", "tok-free");

  const pub = await t.query(api.public.publicCourse, { token: "tok-free" });
  expect(pub!.paywall).toBeUndefined();
  expect(await t.query(api.public.publicLesson, { token: "tok-free", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
});

test("an Entitlement is Edition-scoped — `es` does not unlock `ur`", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  const dave = await seedUser(t, "dave@example.com");
  await price(t, topicId, "es", 500, "zar");
  await price(t, topicId, "ur", 700, "zar");
  await entitle(t, topicId, dave, "es"); // dave bought Spanish only

  // Spanish: entitled → full (English fallback content, no `es` rows seeded).
  expect(await asUser(t, dave).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "es" })).toMatchObject({
    locked: false,
  });
  // Urdu: NOT unlocked by the Spanish Entitlement → Preview only.
  const urHdr = await asUser(t, dave).query(api.content.courseHeader, { topicSlug: "hindi", lang: "ur" });
  expect(urHdr).toMatchObject({ role: "preview", lang: "ur" });
  expect(await asUser(t, dave).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "ur" })).toMatchObject({
    locked: true,
  });
  expect(await asUser(t, dave).query(api.content.getLesson, { topicSlug: "hindi", key: "0001", lang: "ur" })).toMatchObject({
    locked: false, // the Preview is readable in any language
  });
});

// ---- temporary Admin/dev grant: enough to demo the unlock -------------------

test("Admin grant flips a caller from Preview to full; revoke flips it back", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  const admin = await seedAdmin(t, "admin@example.com");
  const carol = await seedUser(t, "carol@example.com");
  await price(t, topicId, "en", 500, "zar");

  // Before: Preview only.
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  // Admin grants — carol now reads everything.
  await asUser(t, admin).mutation(api.market.grantEntitlement, { email: "carol@example.com", topicSlug: "hindi", lang: "en" });
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });

  // Idempotent: a second grant doesn't create a second row.
  await asUser(t, admin).mutation(api.market.grantEntitlement, { email: "carol@example.com", topicSlug: "hindi", lang: "en" });
  const rows = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", carol)).collect(),
  );
  expect(rows).toHaveLength(1);

  // Revoke — back to the paygate.
  await asUser(t, admin).mutation(api.market.revokeEntitlement, { email: "carol@example.com", topicSlug: "hindi", lang: "en" });
  expect(await asUser(t, carol).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });
});

test("grant/revoke Entitlement are Admin-only temp tools (Slice 3 replaces them)", async () => {
  const t = convexTest(schema, modules);
  await fixture(t);
  await seedAdmin(t, "admin@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedUser(t, "carol@example.com");

  // A non-Admin cannot grant or revoke an Entitlement. (Pricing is no longer an
  // Admin tool — it's the Seller action, covered in sellers.test.ts.)
  await expect(
    asUser(t, bob).mutation(api.market.grantEntitlement, { email: "carol@example.com", topicSlug: "hindi", lang: "en" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, bob).mutation(api.market.revokeEntitlement, { email: "carol@example.com", topicSlug: "hindi", lang: "en" }),
  ).rejects.toThrow();
});

test("an entitled buyer gets Viewer semantics — own Progress, but no Responses", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  const dave = await seedUser(t, "dave@example.com");
  await price(t, topicId, "en", 500, "zar");
  await entitle(t, topicId, dave, "en");

  // Own Progress: an entitled buyer tracks their own, like any Viewer.
  await asUser(t, dave).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "completed" });
  expect(await asUser(t, dave).query(api.capture.myProgress, { topicSlug: "hindi" })).toEqual([
    { lessonKey: "0001", status: "completed" },
  ]);

  // Responses stay owner-only — a buyer cannot record quiz answers.
  await expect(
    asUser(t, dave).mutation(api.capture.recordResponse, {
      topicSlug: "hindi",
      lessonKey: "0001",
      quizId: "q1",
      answer: "A",
      correct: true,
    }),
  ).rejects.toThrow();

  // Questions stay owner-only too (PRD: a buyer "cannot record Responses or ask
  // Questions") — asking is refused by the owner gate.
  await expect(
    asUser(t, dave).mutation(api.capture.askQuestion, {
      topicSlug: "hindi",
      lessonKey: "0001",
      text: "why?",
    }),
  ).rejects.toThrow();
});

test("myPurchases lists a buyer's entitled courses with their own progress; others see none", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await fixture(t);
  const dave = await seedUser(t, "dave@example.com");
  const carol = await seedUser(t, "carol@example.com");
  await price(t, topicId, "en", 500, "zar");
  await entitle(t, topicId, dave, "en");

  // The buyer sees their purchase as a card, with their OWN (fresh) progress.
  expect(await asUser(t, dave).query(api.market.myPurchases, {})).toMatchObject([
    { slug: "hindi", lessonCount: 2, completedCount: 0, langs: [{ lang: "en", native: "English" }] },
  ]);

  // Their own completion moves only their card's count.
  await asUser(t, dave).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001", status: "completed" });
  expect((await asUser(t, dave).query(api.market.myPurchases, {}))[0]).toMatchObject({ completedCount: 1 });

  // A non-buyer has no purchases.
  expect(await asUser(t, carol).query(api.market.myPurchases, {})).toEqual([]);
});
