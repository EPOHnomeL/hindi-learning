/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  // assertAdmin reads this at call time; ensureTopic tests need it to match.
  process.env.PUBLISH_SECRET = "test-secret";
});

// Sign in as a seeded user. `userId|session` is the subject shape Convex Auth's
// getAuthUserId parses back into the userId.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string, seq?: number) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, seq }));
}

test("listTopics returns only the signed-in user's topics", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi", "Hindi", 1);
  await seedTopic(t, bob, "spanish", "Spanish", 1);

  const aliceTopics = await asUser(t, alice).query(api.content.listTopics, {});
  expect(aliceTopics.map((x) => x.slug)).toEqual(["hindi"]);
});

test("listTopics orders by seq then creation, unsequenced last", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "third", "Third"); // no seq → last
  await seedTopic(t, alice, "first", "First", 1);
  await seedTopic(t, alice, "second", "Second", 2);

  const topics = await asUser(t, alice).query(api.content.listTopics, {});
  expect(topics.map((x) => x.slug)).toEqual(["first", "second", "third"]);
});

test("listLessons is seq-ordered and excludes superseded lessons", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B", html: "<p>b</p>" });
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" });
    await ctx.db.insert("lessons", { topicId, key: "0000-old", seq: 0, title: "Old", html: "<p>old</p>", supersededBy: "0001-a" });
  });

  const lessons = await asUser(t, alice).query(api.content.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => l.key)).toEqual(["0001-a", "0002-b"]);
});

test("cross-owner isolation: a user asking for another's topicSlug gets nothing", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const bobTopic = await seedTopic(t, bob, "hindi", "Hindi", 1);
  await t.run((ctx) => ctx.db.insert("lessons", { topicId: bobTopic, key: "0001-a", seq: 1, title: "A", html: "<p>x</p>" }));

  const asAlice = asUser(t, alice);
  expect(await asAlice.query(api.content.listLessons, { topicSlug: "hindi" })).toEqual([]);
  expect(await asAlice.query(api.content.getLesson, { topicSlug: "hindi", key: "0001-a" })).toBeNull();
  expect(await asAlice.query(api.content.listReferences, { topicSlug: "hindi" })).toEqual([]);
});

test("getLesson / listReferences / getReference are owner+topic scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>lesson</p>" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", html: "<p>ref</p>", contentHash: "h" });
  });
  const asAlice = asUser(t, alice);

  expect(await asAlice.query(api.content.getLesson, { topicSlug: "hindi", key: "0001-a" })).toMatchObject({ key: "0001-a", html: "<p>lesson</p>" });
  expect(await asAlice.query(api.content.listReferences, { topicSlug: "hindi" })).toMatchObject([{ key: "grammar", title: "Grammar" }]);
  expect(await asAlice.query(api.content.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ key: "grammar", html: "<p>ref</p>" });
  // wrong slug → nothing
  expect(await asAlice.query(api.content.getReference, { topicSlug: "nope", key: "grammar" })).toBeNull();
});

test("ensureTopic creates an owned topic, backfills an unowned one, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const secret = "test-secret";

  // Pre-existing UNOWNED legacy row (the live Hindi topic before this issue).
  const legacy = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));

  // ensureTopic backfills its ownerId rather than creating a duplicate.
  const id1 = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id1).toBe(legacy);
  const owned = await t.run((ctx) => ctx.db.get(legacy));
  expect(owned?.ownerId).toBe(alice);

  // Idempotent: a second call returns the same id, no duplicate.
  const id2 = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id2).toBe(legacy);

  // Now the owner can see it through the reader.
  const topics = await asUser(t, alice).query(api.content.listTopics, {});
  expect(topics.map((x) => x.slug)).toEqual(["hindi"]);

  // A brand-new slug creates a fresh owned topic.
  const fresh = await t.mutation(api.content.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "spanish", title: "Spanish" });
  expect(fresh).not.toBe(legacy);
});

test("ensureTopic rejects a bad secret and an unknown owner", async () => {
  const t = convexTest(schema, modules);
  await seedUser(t, "alice@example.com");
  await expect(t.mutation(api.content.ensureTopic, { secret: "wrong", ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
  await expect(t.mutation(api.content.ensureTopic, { secret: "test-secret", ownerEmail: "ghost@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
});

test("seedTopic creates a seeded topic; identical titles get distinct slugs", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const as = asUser(t, alice);

  const r1 = await as.mutation(api.content.seedTopic, { title: "Koine Greek!", why: "read the NT" });
  const r2 = await as.mutation(api.content.seedTopic, { title: "Koine Greek!", why: "again" });
  expect(r1.slug).toBe("koine-greek");
  expect(r2.slug).toBe("koine-greek-2");

  const topics = await as.query(api.content.listTopics, {});
  expect(topics.find((x) => x.slug === "koine-greek")).toMatchObject({ title: "Koine Greek!", status: "seeded", mission: null });
});

test("editMission sets the learner's mission (owner-scoped); publishMission flips status to active", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const as = asUser(t, alice);
  const secret = "test-secret";
  const { slug } = await as.mutation(api.content.seedTopic, { title: "Greek", why: "NT" });

  await as.mutation(api.content.editMission, { topicSlug: slug, mission: "Read John in Greek." });
  expect((await as.query(api.content.listTopics, {})).find((x) => x.slug === slug)?.mission).toBe("Read John in Greek.");
  // bob can't edit alice's topic
  await expect(asUser(t, bob).mutation(api.content.editMission, { topicSlug: slug, mission: "hijack" })).rejects.toThrow();

  // The Routine publishes a drafted mission and activates the topic.
  await t.mutation(api.content.publishMission, { secret, ownerEmail: "alice@example.com", topicSlug: slug, mission: "Drafted mission." });
  const topic = (await as.query(api.content.listTopics, {})).find((x) => x.slug === slug);
  expect(topic).toMatchObject({ status: "active", mission: "Drafted mission." });
});
