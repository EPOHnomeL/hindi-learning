/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { asUser, seedTopic, seedUser } from "./testHelpers";

const modules = import.meta.glob("/convex/**/*.ts");

beforeAll(() => {
  // assertAdmin reads this at call time; ensureTopic tests need it to match.
  process.env.PUBLISH_SECRET = "test-secret";
});

test("publishLesson stores the body as a blob (htmlStorageId, no inline html) and stays immutable", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const secret = "test-secret";

  const sid = await t.run((ctx) => ctx.storage.store(new Blob(["<p>body</p>"], { type: "text/html" })));
  const r1 = await t.mutation(api.content.publish.publishLesson, { secret, topicId, key: "0001", seq: 1, title: "One", storageId: sid });
  expect(r1.status).toBe("inserted");
  const row = await t.run((ctx) =>
    ctx.db.query("lessons").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001")).unique(),
  );
  expect(row?.htmlStorageId).toBe(sid);
  expect(row?.html).toBeUndefined();

  // Immutable: a second publish drops the redundant upload and no-ops, leaving
  // the original blob untouched.
  const sid2 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>again</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.publish.publishLesson, { secret, topicId, key: "0001", seq: 1, title: "One", storageId: sid2 })).status).toBe("exists");
  expect(await t.run((ctx) => ctx.db.system.get(sid2))).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(sid))).not.toBeNull();

  await expect(
    t.mutation(api.content.publish.publishLesson, { secret: "wrong", topicId, key: "x", seq: 1, title: "x", storageId: sid }),
  ).rejects.toThrow();
});

test("upsertReference inserts, drops a redundant unchanged blob, and deletes the old blob on change", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", 1);
  const secret = "test-secret";

  const sid1 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v1</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.publish.upsertReference, { secret, topicId, key: "g", title: "G", storageId: sid1, contentHash: "h1" })).status).toBe("inserted");

  // Unchanged (same hash) → the new upload is redundant and dropped; row untouched.
  const dup = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v1</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.publish.upsertReference, { secret, topicId, key: "g", title: "G", storageId: dup, contentHash: "h1" })).status).toBe("unchanged");
  expect(await t.run((ctx) => ctx.db.system.get(dup))).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(sid1))).not.toBeNull();

  // Changed → point at the new blob and delete the superseded one.
  const sid2 = await t.run((ctx) => ctx.storage.store(new Blob(["<p>v2</p>"], { type: "text/html" })));
  expect((await t.mutation(api.content.publish.upsertReference, { secret, topicId, key: "g", title: "G2", storageId: sid2, contentHash: "h2" })).status).toBe("updated");
  const row = await t.run((ctx) =>
    ctx.db.query("references").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "g")).unique(),
  );
  expect(row?.htmlStorageId).toBe(sid2);
  expect(await t.run((ctx) => ctx.db.system.get(sid1))).toBeNull();
});

test("ensureTopic creates an owned topic, backfills an unowned one, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const secret = "test-secret";

  // Pre-existing UNOWNED legacy row (the live Hindi topic before this issue).
  const legacy = await t.run((ctx) => ctx.db.insert("topics", { slug: "hindi", title: "Hindi" }));

  // ensureTopic backfills its ownerId rather than creating a duplicate.
  const id1 = await t.mutation(api.content.publish.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id1).toBe(legacy);
  const owned = await t.run((ctx) => ctx.db.get(legacy));
  expect(owned?.ownerId).toBe(alice);

  // Idempotent: a second call returns the same id, no duplicate.
  const id2 = await t.mutation(api.content.publish.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" });
  expect(id2).toBe(legacy);

  // Now the owner can see it through the reader.
  const topics = await asUser(t, alice).query(api.content.reader.listTopics, {});
  expect(topics.map((x) => x.slug)).toEqual(["hindi"]);

  // A brand-new slug creates a fresh owned topic.
  const fresh = await t.mutation(api.content.publish.ensureTopic, { secret, ownerEmail: "alice@example.com", slug: "spanish", title: "Spanish" });
  expect(fresh).not.toBe(legacy);
});

test("ensureTopic rejects a bad secret and an unknown owner", async () => {
  const t = convexTest(schema, modules);
  await seedUser(t, "alice@example.com");
  await expect(t.mutation(api.content.publish.ensureTopic, { secret: "wrong", ownerEmail: "alice@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
  await expect(t.mutation(api.content.publish.ensureTopic, { secret: "test-secret", ownerEmail: "ghost@example.com", slug: "hindi", title: "Hindi" })).rejects.toThrow();
});
