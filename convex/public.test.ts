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
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" }));

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
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B", html: "<p>b</p>" });
    // A superseded lesson must not appear in the sidebar.
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", html: "<p>o</p>", supersededBy: "0001-a" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", html: "<p>g</p>", contentHash: "h" });
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
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>lesson</p>" });
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", html: "<p>old</p>", supersededBy: "0001-a" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", html: "<p>ref</p>", contentHash: "h" });
  });
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  expect(await t.query(api.public.publicLesson, { token: token!, key: "0001-a" })).toMatchObject({ key: "0001-a", html: "<p>lesson</p>" });
  expect(await t.query(api.public.publicReference, { token: token!, key: "grammar" })).toMatchObject({ key: "grammar", html: "<p>ref</p>" });

  expect(await t.query(api.public.publicLesson, { token: token!, key: "0000-old" })).toBeNull(); // superseded
  expect(await t.query(api.public.publicLesson, { token: "nope", key: "0001-a" })).toBeNull(); // wrong token
  expect(await t.query(api.public.publicReference, { token: token!, key: "missing" })).toBeNull(); // unknown key
});

test("setTopicPublic: regenerate invalidates the old token, make-private revokes, and it's owner-only", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" }));

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

test("the read seam is identity-agnostic: any signed-in user (and the owner) read a public Topic by token", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const someoneElse = await seedUser(t, "else@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" }));
  const token = await asUser(t, owner).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true });

  // No Share needed — the token alone grants the read, regardless of who's asking.
  expect(await asUser(t, someoneElse).query(api.public.publicCourse, { token: token! })).toMatchObject({ title: "Hindi" });
  // The owner opening their own share URL previews the same Guest view.
  expect(await asUser(t, owner).query(api.public.publicCourse, { token: token! })).toMatchObject({ title: "Hindi" });
});
