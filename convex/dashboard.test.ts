/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The manage route's Dashboard tab (ui-overhaul 23): one owner-gated course-wide
// query behind the whole tab. Exercised at the Convex function seam, like
// sharing-readonly.test.ts.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// A course with `lessons` non-superseded Lessons, owned by `owner`.
async function seedCourse(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, lessons: number) {
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId, slug: "hindi", title: "Hindi", status: "active" }),
  );
  for (let i = 1; i <= lessons; i++) {
    await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: `000${i}-l`, seq: i, title: `L${i}` }));
  }
  return topicId;
}

// ---- Owner gating ----------------------------------------------------------

test("courseStats is owner-only: null signed-out, null for a viewer and a stranger", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedCourse(t, owner, 1);
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en", role: "viewer" }));

  expect(await t.query(api.dashboard.courseStats, { topicSlug: "hindi" })).toBeNull();
  expect(await asUser(t, viewer).query(api.dashboard.courseStats, { topicSlug: "hindi" })).toBeNull();
  expect(await asUser(t, stranger).query(api.dashboard.courseStats, { topicSlug: "hindi" })).toBeNull();
  expect(await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" })).not.toBeNull();
});

// ---- People, editors, per language ----------------------------------------

test("people counts a human once, per language counts them on every Edition they hold", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const both = await seedUser(t, "both@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const joiner = await seedUser(t, "joiner@example.com");
  const topicId = await seedCourse(t, owner, 1);

  await t.run(async (ctx) => {
    // One human shared into two Editions.
    await ctx.db.insert("shares", { topicId, viewerId: both, lang: "en", role: "viewer" });
    await ctx.db.insert("shares", { topicId, viewerId: both, lang: "es", role: "editor" });
    // The paid and self-serve twins of a Share.
    await ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "es" });
    await ctx.db.insert("enrollments", { topicId, userId: joiner, lang: "fr" });
    // An invite to an address with no account yet.
    await ctx.db.insert("pendingShares", { topicId, email: "Invited@Example.com", lang: "es", role: "editor" });
    // The owner holds their own course; they are not one of "the people".
    await ctx.db.insert("shares", { topicId, viewerId: owner, lang: "en", role: "editor" });
  });

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats).not.toBeNull();
  // both + buyer + joiner + the pending invite. The owner's own row is excluded.
  expect(stats!.people).toBe(4);
  // `both` on es and the pending invite. An Entitlement and an Enrollment are
  // access, never an editing right.
  expect(stats!.editors).toBe(2);
  expect(stats!.perLanguage).toEqual([
    { lang: "es", people: 3 }, // both + buyer + the invite
    { lang: "en", people: 1 }, // both (the owner's row excluded)
    { lang: "fr", people: 1 }, // joiner
  ]);
});

test("a legacy Share with no lang counts on the English Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const legacy = await seedUser(t, "legacy@example.com");
  const topicId = await seedCourse(t, owner, 1);
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: legacy }));

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.perLanguage).toEqual([{ lang: "en", people: 1 }]);
  // An absent role reads as viewer, so a legacy row never inflates the editors.
  expect(stats!.editors).toBe(0);
});

test("prices list only the priced Editions, so an absent lang reads as free", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 1);
  await t.run(async (ctx) => {
    await ctx.db.insert("listings", { topicId, lang: "es", amount: 15000, currency: "ZAR" });
    await ctx.db.insert("listings", { topicId, lang: "en", amount: 9900, currency: "ZAR" });
  });

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.prices).toEqual([
    { lang: "en", amount: 9900, currency: "ZAR" },
    { lang: "es", amount: 15000, currency: "ZAR" },
  ]);
});

// ---- The progress histogram ------------------------------------------------

// Mark the first `n` Lessons of a 10-Lesson course completed for `userId`.
async function complete(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">, n: number) {
  for (let i = 1; i <= n; i++) {
    await t.run((ctx) => ctx.db.insert("progress", { topicId, userId, lessonKey: `000${i}-l`, status: "completed" }));
  }
}

function bucket(stats: { buckets: { key: string; count: number }[] }, key: string) {
  return stats.buckets.find((b) => b.key === key)?.count;
}

test("readers land in the seven buckets, with 0% and 100% exact", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  const readers: Id<"users">[] = [];
  for (const n of [0, 1, 3, 5, 7, 9, 10]) {
    const u = await seedUser(t, `r${n}@example.com`);
    readers.push(u);
    await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: u, lang: "en", role: "viewer" }));
    await complete(t, topicId, u, n);
  }

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.lessonCount).toBe(10);
  expect(stats!.learners).toBe(7);
  expect(stats!.buckets).toEqual([
    { key: "0", count: 1 }, // 0/10
    { key: "1-20", count: 1 }, // 1/10 = 10%
    { key: "20-40", count: 1 }, // 3/10 = 30%
    { key: "40-60", count: 1 }, // 5/10 = 50%
    { key: "60-80", count: 1 }, // 7/10 = 70%
    { key: "80-99", count: 1 }, // 9/10 = 90%
    { key: "100", count: 1 }, // 10/10
  ]);
  expect(stats!.truncated).toBe(false);
});

test("a band's lower edge belongs to the band, and 100% needs every Lesson", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  const onEdge = await seedUser(t, "edge@example.com");
  const nearly = await seedUser(t, "nearly@example.com");
  await t.run(async (ctx) => {
    await ctx.db.insert("shares", { topicId, viewerId: onEdge, lang: "en", role: "viewer" });
    await ctx.db.insert("shares", { topicId, viewerId: nearly, lang: "en", role: "viewer" });
  });
  await complete(t, topicId, onEdge, 2); // exactly 20%
  await complete(t, topicId, nearly, 9); // 90%, near but not finished

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(bucket(stats!, "1-20")).toBe(0);
  expect(bucket(stats!, "20-40")).toBe(1);
  expect(bucket(stats!, "80-99")).toBe(1);
  expect(bucket(stats!, "100")).toBe(0);
});

test("the owner's own reading is not a learner, and an opened Lesson is not a completed one", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  const browsing = await seedUser(t, "browsing@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: browsing, lang: "en", role: "viewer" }));
  await complete(t, topicId, owner, 10);
  await t.run((ctx) =>
    ctx.db.insert("progress", { topicId, userId: browsing, lessonKey: "0001-l", status: "opened" }),
  );

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.learners).toBe(1);
  expect(bucket(stats!, "0")).toBe(1);
  expect(bucket(stats!, "100")).toBe(0);
});

test("a reader with progress but no grant row is still a learner", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  // The free published Edition path grants access with no row about the reader
  // at all (convex/lib.ts grantsFor), so their progress is the only evidence.
  const anon = await seedUser(t, "anon@example.com");
  await complete(t, topicId, anon, 10);

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.people).toBe(0);
  expect(stats!.learners).toBe(1);
  expect(bucket(stats!, "100")).toBe(1);
});

test("a superseded Lesson leaves both the denominator and the completed count", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  const reader = await seedUser(t, "reader@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: reader, lang: "en", role: "viewer" }));
  await complete(t, topicId, reader, 9);
  // Retire the tenth Lesson: the reader has now finished the course.
  await t.run(async (ctx) => {
    const l = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "00010-l"))
      .unique();
    await ctx.db.patch(l!._id, { supersededBy: "0009-l" });
  });

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.lessonCount).toBe(9);
  expect(bucket(stats!, "100")).toBe(1);
});

// ---- The editor progress rows (ui-overhaul 26) -----------------------------

test("one row per editor per language, carrying that person's own completion marks", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, 10);
  const two = await seedUser(t, "two@example.com");
  const named = await seedUser(t, "named@example.com");
  const plain = await seedUser(t, "plain@example.com");

  await t.run(async (ctx) => {
    await ctx.db.patch(named, { name: "Named Person" });
    // One editor on two Editions.
    await ctx.db.insert("shares", { topicId, viewerId: two, lang: "es", role: "editor" });
    await ctx.db.insert("shares", { topicId, viewerId: two, lang: "fr", role: "editor" });
    await ctx.db.insert("shares", { topicId, viewerId: named, lang: "es", role: "editor" });
    // A Viewer is not an editor and must not appear.
    await ctx.db.insert("shares", { topicId, viewerId: plain, lang: "es", role: "viewer" });
    // An invited editor with no account yet.
    await ctx.db.insert("pendingShares", { topicId, email: "invited@example.com", lang: "fr", role: "editor" });
  });
  await complete(t, topicId, two, 6);
  await complete(t, topicId, named, 10);

  const stats = await asUser(t, owner).query(api.dashboard.courseStats, { topicSlug: "hindi" });
  expect(stats!.editorRows).toEqual([
    // A person's completion is course-wide, so `two` carries 6 on both rows.
    { lang: "es", person: "Named Person", pending: false, completed: 10 },
    { lang: "es", person: "two@example.com", pending: false, completed: 6 },
    { lang: "fr", person: "invited@example.com", pending: true, completed: 0 },
    { lang: "fr", person: "two@example.com", pending: false, completed: 6 },
  ]);
});

test("editorRows is owner-only, like the rest of the query", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await seedCourse(t, owner, 10);
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: editor, lang: "es", role: "editor" }));

  // An Editor is not the owner, so the roster (and its email addresses) is
  // refused even though they hold a role on the course.
  expect(await asUser(t, editor).query(api.dashboard.courseStats, { topicSlug: "hindi" })).toBeNull();
  expect(await t.query(api.dashboard.courseStats, { topicSlug: "hindi" })).toBeNull();
});
