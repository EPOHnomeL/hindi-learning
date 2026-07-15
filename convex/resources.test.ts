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

test("resources are owner+topic scoped; a non-owner sees nothing and can't upload", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, bob, "spanish"); // distinct slugs — slugs are globally unique

  const sid = await storeBlob(t, "alice doc");
  await asUser(t, alice).mutation(api.resources.addResource, { topicSlug: "hindi", filename: "a.pdf", storageId: sid });

  // bob's own topic has no resources, and alice's "hindi" (which bob neither owns
  // nor has shared to him) reads as empty — listResources is owner-or-Viewer gated.
  expect(await asUser(t, bob).query(api.resources.listResources, { topicSlug: "spanish" })).toEqual([]);
  expect(await asUser(t, bob).query(api.resources.listResources, { topicSlug: "hindi" })).toEqual([]);
  // uploading to a topic bob doesn't own is rejected
  const sid2 = await storeBlob(t, "x");
  await expect(
    asUser(t, bob).mutation(api.resources.addResource, { topicSlug: "hindi", filename: "x.pdf", storageId: sid2 }),
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

test("addUrlResource adds a link (deduped by url); listResources exposes an openable url for both kinds", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);

  await as.mutation(api.resources.addUrlResource, { topicSlug: "hindi", url: "https://example.com/doc", label: "Spec" });
  await as.mutation(api.resources.addUrlResource, { topicSlug: "hindi", url: "https://example.com/doc" }); // dedupe
  expect(await as.query(api.resources.listResources, { topicSlug: "hindi" })).toMatchObject([
    { kind: "url", filename: "Spec", url: "https://example.com/doc", status: "raw" },
  ]);

  // a file resource exposes a signed blob url to open
  const sid = await storeBlob(t, "pdf bytes");
  await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "h.pdf", storageId: sid });
  const file = (await as.query(api.resources.listResources, { topicSlug: "hindi" })).find((r) => r.kind === "file");
  expect(file?.url).toBeTruthy();
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

test("removeResourceAdmin deletes the row, its raw blob, and processed-artifact blobs", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);
  const secret = "test-secret";

  const sid = await storeBlob(t, "%PDF the book");
  const rid = await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "book.pdf", storageId: sid });
  // a rendered artifact (e.g. a page PNG) referenced from the processed manifest
  const artifact = await storeBlob(t, "rendered page png");
  const hash = (await t.run((ctx) => ctx.db.get(rid)))!.contentHash;
  await t.mutation(api.resources.cacheProcessedResource, {
    secret,
    ownerEmail: "alice@example.com",
    topicSlug: "hindi",
    contentHash: hash,
    processed: { kind: "pdf", pages: [{ n: 1, storageId: artifact, label: "page-1" }] },
  });

  const removed = await t.mutation(api.resources.removeResourceAdmin, { secret, resourceId: rid });
  expect(removed).toMatchObject({ filename: "book.pdf", kind: "file", blobsDeleted: 2 });

  expect(await as.query(api.resources.listResources, { topicSlug: "hindi" })).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(rid))).toBeNull(); // row gone
  expect(await t.run((ctx) => ctx.db.system.get(sid))).toBeNull(); // raw blob gone
  expect(await t.run((ctx) => ctx.db.system.get(artifact))).toBeNull(); // artifact blob gone
});

test("removeResourceAdmin removes a url resource (row only), rejects a bad secret and an unknown id", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  const as = asUser(t, alice);
  const secret = "test-secret";

  const rid = await as.mutation(api.resources.addUrlResource, { topicSlug: "hindi", url: "https://example.com/book" });
  await expect(t.mutation(api.resources.removeResourceAdmin, { secret: "wrong", resourceId: rid })).rejects.toThrow();

  const removed = await t.mutation(api.resources.removeResourceAdmin, { secret, resourceId: rid });
  expect(removed).toMatchObject({ kind: "url", blobsDeleted: 0 });
  expect(await as.query(api.resources.listResources, { topicSlug: "hindi" })).toEqual([]);

  // already deleted → unknown id
  await expect(t.mutation(api.resources.removeResourceAdmin, { secret, resourceId: rid })).rejects.toThrow();
});

test("listResourcesAdmin inventories every topic + resource for an owner email", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await seedTopic(t, alice, "spanish");
  const as = asUser(t, alice);

  const sid = await storeBlob(t, "book bytes");
  await as.mutation(api.resources.addResource, { topicSlug: "hindi", filename: "book.pdf", storageId: sid });
  await as.mutation(api.resources.addUrlResource, { topicSlug: "spanish", url: "https://x.test/doc" });

  const inventory = await t.query(api.resources.listResourcesAdmin, { secret: "test-secret", ownerEmail: "alice@example.com" });
  expect(inventory).toMatchObject([
    { topicSlug: "hindi", topicTitle: "hindi", resources: [{ filename: "book.pdf", kind: "file", status: "raw" }] },
    { topicSlug: "spanish", resources: [{ filename: "https://x.test/doc", kind: "url", url: "https://x.test/doc" }] },
  ]);
  // a file resource exposes a signed blob url so the operator can back it up
  expect(inventory[0]!.resources[0]!.url).toBeTruthy();

  await expect(t.query(api.resources.listResourcesAdmin, { secret: "wrong", ownerEmail: "alice@example.com" })).rejects.toThrow();
  await expect(t.query(api.resources.listResourcesAdmin, { secret: "test-secret", ownerEmail: "nobody@example.com" })).rejects.toThrow();
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
