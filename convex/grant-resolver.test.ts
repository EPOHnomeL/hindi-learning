/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { grantsFor } from "./edition";
import type { Id } from "./_generated/dataModel";

// The Edition grant resolver (edition-deepening/02). `grantsFor` is the ONE walk
// over shares/entitlements/enrollments for a caller: it returns each held lang
// mapped to its provenance (viewer > entitled > enrolled), the value the "Shared
// with me" / "Purchases" / "Joined" badges read. Owner is NOT a grant type
// (owner langs come from translationJobs) and is resolved by the callers, so it
// never appears here. These tests pin the walk directly; `enrollment.test.ts`
// covers how heldLangs/editionAccessLevel consume it.

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const }));
}
async function share(
  t: ReturnType<typeof convexTest>,
  viewerId: Id<"users">,
  topicId: Id<"topics">,
  lang?: string,
) {
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId, ...(lang ? { lang } : {}) }));
}
async function entitle(t: ReturnType<typeof convexTest>, userId: Id<"users">, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("entitlements", { userId, topicId, lang }));
}
async function enroll(t: ReturnType<typeof convexTest>, userId: Id<"users">, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("enrollments", { userId, topicId, lang }));
}
// `t.run` serialises its return through Convex values (no Map support), so spread
// the walk to entries inside the txn and rebuild the Map in the assertion.
async function grants(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">) {
  const entries = await t.run(async (ctx) => [...(await grantsFor(ctx, topicId, userId))]);
  return new Map(entries);
}

test("no grants → empty map", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");

  expect(await grants(t, topicId, caller)).toEqual(new Map());
});

test("a Share yields provenance `viewer` for its lang", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await share(t, caller, topicId, "es");

  expect(await grants(t, topicId, caller)).toEqual(new Map([["es", "viewer"]]));
});

test("a legacy Share (no lang) grants the English Edition as `viewer`", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await share(t, caller, topicId); // no lang → shareLang() reads "en"

  expect(await grants(t, topicId, caller)).toEqual(new Map([["en", "viewer"]]));
});

test("an Entitlement yields `entitled`; an Enrollment yields `enrolled`", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await entitle(t, caller, topicId, "en");
  await enroll(t, caller, topicId, "es");

  expect(await grants(t, topicId, caller)).toEqual(
    new Map([
      ["en", "entitled"],
      ["es", "enrolled"],
    ]),
  );
});

test("precedence on one lang: Share > Entitlement > Enrollment", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  // All three grants on the same Edition — the Share must win the badge.
  await share(t, caller, topicId, "en");
  await entitle(t, caller, topicId, "en");
  await enroll(t, caller, topicId, "en");

  expect(await grants(t, topicId, caller)).toEqual(new Map([["en", "viewer"]]));
});

test("precedence on one lang: Entitlement beats Enrollment when there is no Share", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await entitle(t, caller, topicId, "en");
  await enroll(t, caller, topicId, "en");

  expect(await grants(t, topicId, caller)).toEqual(new Map([["en", "entitled"]]));
});

test("a legacy Share (no lang) on `en` still wins precedence over an `en` Entitlement", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  // The Share carries no lang → shareLang() reads "en"; it must still claim "en"
  // before the Entitlement's set-if-absent runs.
  await share(t, caller, topicId);
  await entitle(t, caller, topicId, "en");

  expect(await grants(t, topicId, caller)).toEqual(new Map([["en", "viewer"]]));
});

test("multiple Shares on distinct langs accumulate as separate `viewer` entries", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await share(t, caller, topicId, "es");
  await share(t, caller, topicId, "fr");

  expect(await grants(t, topicId, caller)).toEqual(
    new Map([
      ["es", "viewer"],
      ["fr", "viewer"],
    ]),
  );
});

test("distinct langs from distinct sources each keep their own provenance", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await share(t, caller, topicId, "es");
  await entitle(t, caller, topicId, "fr");
  await enroll(t, caller, topicId, "de");

  expect(await grants(t, topicId, caller)).toEqual(
    new Map([
      ["es", "viewer"],
      ["fr", "entitled"],
      ["de", "enrolled"],
    ]),
  );
});

test("grants are per-caller: another user's grants are not returned", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const caller = await seedUser(t, "caller@example.com");
  const other = await seedUser(t, "other@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await share(t, other, topicId, "es");

  expect(await grants(t, topicId, caller)).toEqual(new Map());
});
