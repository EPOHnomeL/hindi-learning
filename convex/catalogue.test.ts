/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Course publishing at the **Edition** grain (course-publishing commit 1): an
// owner marks one (Topic, language) Edition `published`, which is what lists it
// in the tenant catalogue. Publishing is a row in `publishedEditions`, NOT a
// `topics.status` value (that grain is superseded — see the ADR), so it composes
// with prices, public links and shares instead of folding into the authoring
// lifecycle.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const }));
}
async function readRows(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return await t.run((ctx) =>
    ctx.db.query("publishedEditions").withIndex("by_topic", (q) => q.eq("topicId", topicId)).collect(),
  );
}

test("the owner publishes and unpublishes one Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");

  // Unpublished is the absence of a `published: true` row — no row to start with.
  expect(await readRows(t, topicId)).toEqual([]);

  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: true,
  });
  expect(await readRows(t, topicId)).toMatchObject([{ lang: "en", published: true }]);

  // Unpublishing flips the boolean in place (one row per Edition, never a second).
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: false,
  });
  expect(await readRows(t, topicId)).toMatchObject([{ lang: "en", published: false }]);

  // Re-publishing reuses that row.
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: true,
  });
  expect(await readRows(t, topicId)).toMatchObject([{ lang: "en", published: true }]);
});

test("publishing is idempotent", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  const args = { topicSlug: "hindi", lang: "en", published: true };
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, args);
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, args);
  expect(await readRows(t, topicId)).toHaveLength(1);
});

test("unpublishing an Edition that was never published writes nothing", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: false,
  });
  expect(await readRows(t, topicId)).toEqual([]);
});

test("publish is owner-only: a non-owner and an anonymous caller are refused", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const other = await seedUser(t, "other@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  const args = { topicSlug: "hindi", lang: "en", published: true };

  // A Share does not confer publish — this is the owner's decision alone.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: other, lang: "en" }));

  await expect(asUser(t, other).mutation(api.catalogue.setEditionPublished, args)).rejects.toThrow();
  await expect(t.mutation(api.catalogue.setEditionPublished, args)).rejects.toThrow();
  expect(await readRows(t, topicId)).toEqual([]);
});

test("only a real Edition can be published: a non-English language needs a ready translation", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  const es = { topicSlug: "hindi", lang: "es", published: true };

  // No translation job at all.
  await expect(asUser(t, owner).mutation(api.catalogue.setEditionPublished, es)).rejects.toThrow();

  // A job still translating is not yet an Edition.
  const jobId = await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 1, done: 0, failed: 0 }),
  );
  await expect(asUser(t, owner).mutation(api.catalogue.setEditionPublished, es)).rejects.toThrow();

  await t.run((ctx) => ctx.db.patch(jobId, { status: "ready" as const }));
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, es);
  expect(await readRows(t, topicId)).toMatchObject([{ lang: "es", published: true }]);
});

test("the owner's Editions panel reports each Edition's published state", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "es", status: "ready", total: 1, done: 1, failed: 0 }),
  );

  const editions = async () =>
    (await asUser(t, owner).query(api.translate.editions, { topicSlug: "hindi" }))!.editions.map((e) => [
      e.lang,
      e.published,
    ]);
  expect(await editions()).toEqual([
    ["en", false],
    ["es", false],
  ]);

  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "es",
    published: true,
  });
  expect(await editions()).toEqual([
    ["en", false],
    ["es", true],
  ]);
});

test("unpublishing a language whose Edition has gone away still works", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang: "es", published: true }));

  // The ready-Edition guard is create-side only, so an owner can always take a
  // stranded Edition out of the catalogue (mirrors clearEditionPrice staying un-gated).
  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "es",
    published: false,
  });
  expect(await readRows(t, topicId)).toMatchObject([{ lang: "es", published: false }]);
});
