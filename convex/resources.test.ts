/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug }));
}
async function storeBlob(t: ReturnType<typeof convexTest>, bytes: string) {
  return await t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "application/pdf" })));
}

test("addResource stores a raw file resource that listResources returns", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  const storageId = await storeBlob(t, "%PDF-1.4 handbook");
  await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "handbook.pdf", storageId });

  const list = await as.query(api.resources.listResources, { topicSlug: "hindi" });
  expect(list).toMatchObject([{ filename: "handbook.pdf", status: "raw", kind: "file" }]);
});

test("addResource dedupes identical bytes — one row, redundant blob dropped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  const sid1 = await storeBlob(t, "same bytes");
  const id1 = await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "a.pdf", storageId: sid1 });
  const sid2 = await storeBlob(t, "same bytes"); // identical content → identical sha256
  const id2 = await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "a-again.pdf", storageId: sid2 });

  expect(id2).toBe(id1); // existing row returned, no duplicate
  expect(await as.query(api.resources.listResources, { topicSlug: "hindi" })).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.system.get(sid2))).toBeNull(); // redundant blob deleted
});

test("resources are owner+topic scoped; uploading to an unowned topic throws", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, bob, "hindi"); // bob has his own same-slug topic

  const sid = await storeBlob(t, "alice doc");
  await asUser(t, alice).mutation(api.resources.addResource, { topicSlug: "hindi", filename: "a.pdf", storageId: sid });

  // bob's "hindi" is a different topic — none of alice's resources leak in
  expect(await asUser(t, bob).query(api.resources.listResources, { topicSlug: "hindi" })).toEqual([]);
  // uploading to a slug bob doesn't own is rejected
  const sid2 = await storeBlob(t, "x");
  await expect(
    asUser(t, bob).mutation(api.resources.addResource, { topicSlug: "spanish", filename: "x.pdf", storageId: sid2 }),
  ).rejects.toThrow();
});

test("generateUploadUrl and addResource require auth", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.resources.generateUploadUrl, {})).rejects.toThrow();
  const sid = await storeBlob(t, "x");
  await expect(t.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "x.pdf", storageId: sid })).rejects.toThrow();
});

test("cacheProcessedResource fills processed + flips to ready, idempotently", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);
  const secret = "test-secret";

  const sid = await storeBlob(t, "%PDF handbook");
  const rid = await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "h.pdf", storageId: sid });
  const hash = (await t.run((ctx) => ctx.db.get(rid)))!.contentHash;

  await t.mutation(api.resources.cacheProcessedResource, {
    secret,
    ownerEmail: "alice@example.com",
    topicSlug: "hindi",
    contentHash: hash,
    processed: { pages: ["page-1", "page-2"] },
  });
  expect(await as.query(api.resources.listResources, { topicSlug: "hindi" })).toMatchObject([{ status: "ready" }]);
  expect((await t.run((ctx) => ctx.db.get(rid)))!.processed).toEqual({ pages: ["page-1", "page-2"] });

  // Idempotent re-cache (e.g. a second concurrent run) overwrites, stays ready.
  await t.mutation(api.resources.cacheProcessedResource, {
    secret, ownerEmail: "alice@example.com", topicSlug: "hindi", contentHash: hash, processed: { pages: ["page-1", "page-2"] },
  });
  expect((await t.run((ctx) => ctx.db.get(rid)))!.status).toBe("ready");
});

test("addResourceAdmin records an operator upload owner-scoped by email, and dedupes", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const secret = "test-secret";

  const sid = await storeBlob(t, "handbook bytes");
  const id1 = await t.mutation(api.resources.addResourceAdmin, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", filename: "Handbook.pdf", storageId: sid });
  const sid2 = await storeBlob(t, "handbook bytes"); // identical → dedupe
  const id2 = await t.mutation(api.resources.addResourceAdmin, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi", filename: "Handbook.pdf", storageId: sid2 });
  expect(id2).toBe(id1);
  expect(await asUser(t, alice).query(api.resources.listResources, { topicSlug: "hindi" })).toMatchObject([{ filename: "Handbook.pdf", status: "raw" }]);

  await expect(
    t.mutation(api.resources.addResourceAdmin, { secret: "wrong", ownerEmail: "alice@example.com", topicSlug: "hindi", filename: "x", storageId: sid }),
  ).rejects.toThrow();
});

test("cacheProcessedResource rejects a bad secret and an unknown contentHash", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await expect(
    t.mutation(api.resources.cacheProcessedResource, { secret: "wrong", ownerEmail: "alice@example.com", topicSlug: "hindi", contentHash: "x", processed: {} }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.resources.cacheProcessedResource, { secret: "test-secret", ownerEmail: "alice@example.com", topicSlug: "hindi", contentHash: "nope", processed: {} }),
  ).rejects.toThrow();
});
