/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { assertTenantFlag } from "./lib";
import type { Id } from "./_generated/dataModel";

// Issue 17 — server-side feature-flag enforcement. The five create-side mutations
// throw when their tenant's flag is off; read paths and default-site (no
// tenantSlug) content are untouched (flag-off is frozen, not revoked).

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});
const secret = "test-secret";

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

const LIGHT = {
  paper: "#fff", card: "#fff", ink: "#000", soft: "#111", line: "#222",
  accent: "#333", accent2: "#444", gold: "#555", hi: "#666",
  danger: "#777", good: "#888", "good-b": "#999", bad: "#aaa", "bad-b": "#bbb",
};
const ALL_ON = { certificates: true, translations: true, publicLinks: true, qa: true, seeding: true };

// Seed a tenant row with `flags` (all-on by default; override the ones under test).
async function seedTenant(
  t: ReturnType<typeof convexTest>,
  slug: string,
  flags: Partial<typeof ALL_ON> = {},
) {
  await t.mutation(api.tenants.seedTenant, {
    secret, slug, displayName: slug.toUpperCase(), theme: { light: LIGHT }, flags: { ...ALL_ON, ...flags },
  });
}

// An Allowlisted user, optionally tenant-scoped (for the seedTopic gate).
async function seedUser(t: ReturnType<typeof convexTest>, email: string, tenantSlug?: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email, ...(tenantSlug ? { tenantSlug } : {}) }));
  await t.mutation(internal.whitelist.seedEmail, { email });
  return userId;
}

// A completed Topic owned by `ownerId`, optionally tagged to a tenant. Completed
// so claimCertificate/startTranslation reach their flag gate.
async function seedTopic(
  t: ReturnType<typeof convexTest>,
  ownerId: Id<"users">,
  slug: string,
  tenantSlug?: string,
) {
  return await t.run((ctx) =>
    ctx.db.insert("topics", {
      ownerId, slug, title: slug, status: "completed", ...(tenantSlug ? { tenantSlug } : {}),
    }),
  );
}

// One completed lesson so the certificate eligibility gate passes.
async function seedCompletedLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1" });
    await ctx.db.insert("progress", { topicId, userId, lessonKey: "0001", status: "completed" });
  });
}

// ---- assertTenantFlag (the helper itself) -----------------------------------

test("assertTenantFlag: no-ops when tenantSlug is undefined (default site — every flag implicitly on)", async () => {
  const t = convexTest(schema, modules);
  // t.run coerces the helper's `undefined` return to null.
  await expect(t.run((ctx) => assertTenantFlag(ctx, undefined, "certificates"))).resolves.toBeNull();
});

test("assertTenantFlag: passes when the flag is on, throws when off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "on");
  await seedTenant(t, "off", { qa: false });
  await expect(t.run((ctx) => assertTenantFlag(ctx, "on", "qa"))).resolves.toBeNull();
  await expect(t.run((ctx) => assertTenantFlag(ctx, "off", "qa"))).rejects.toThrow();
});

test("assertTenantFlag: fail-closed on a slug with no tenant row", async () => {
  const t = convexTest(schema, modules);
  await expect(t.run((ctx) => assertTenantFlag(ctx, "ghost", "seeding"))).rejects.toThrow();
});

// ---- certificates flag → claimCertificate -----------------------------------

test("claimCertificate throws when the tenant's certificates flag is off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { certificates: false });
  const alice = await seedUser(t, "alice@example.com");
  const topic = await seedTopic(t, alice, "hindi", "upf");
  await seedCompletedLesson(t, topic, alice);
  await expect(
    asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Al" }),
  ).rejects.toThrow();
});

test("claimCertificate succeeds on a tenant with certificates on, and on the default site (no tenantSlug)", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const alice = await seedUser(t, "alice@example.com");
  const onTenant = await seedTopic(t, alice, "hindi", "upf");
  const offTenant = await seedTopic(t, alice, "spanish");
  await seedCompletedLesson(t, onTenant, alice);
  await seedCompletedLesson(t, offTenant, alice);
  await expect(
    asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Al" }),
  ).resolves.toMatchObject({ learnerName: "Al" });
  await expect(
    asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "spanish", name: "Al" }),
  ).resolves.toMatchObject({ learnerName: "Al" });
});

test("a certificate earned before the flag flips off keeps resolving (frozen, not revoked)", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const alice = await seedUser(t, "alice@example.com");
  const topic = await seedTopic(t, alice, "hindi", "upf");
  await seedCompletedLesson(t, topic, alice);
  await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Al" });

  // Flip certificates off, then read + idempotent re-claim both still work.
  await t.run(async (ctx) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique();
    await ctx.db.patch(tenant!._id, { flags: { ...ALL_ON, certificates: false } });
  });
  const view = await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" });
  expect(view?.certificate).toMatchObject({ learnerName: "Al" });
  // Idempotent re-claim returns the existing row (the gate is after the idempotent check).
  await expect(
    asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Al" }),
  ).resolves.toMatchObject({ learnerName: "Al" });
});

// ---- publicLinks flag → setTopicPublic / setEditionPublic -------------------

test("setTopicPublic throws when publicLinks is off, but revoking (isPublic false) is still allowed", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { publicLinks: false });
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await expect(
    asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true }),
  ).rejects.toThrow();
  // Turning a link off is the safe direction — never gated (frozen, not revoked).
  await expect(
    asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: false }),
  ).resolves.toBeNull();
});

test("setEditionPublic (English) throws when publicLinks is off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { publicLinks: false });
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await expect(
    asUser(t, alice).mutation(api.shares.setEditionPublic, { topicSlug: "hindi", lang: "en", isPublic: true }),
  ).rejects.toThrow();
});

test("setTopicPublic succeeds when publicLinks is on and on the default site", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await seedTopic(t, alice, "spanish");
  await expect(
    asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "hindi", isPublic: true }),
  ).resolves.toEqual(expect.any(String));
  await expect(
    asUser(t, alice).mutation(api.shares.setTopicPublic, { topicSlug: "spanish", isPublic: true }),
  ).resolves.toEqual(expect.any(String));
});

// ---- qa flag → askQuestion --------------------------------------------------

test("askQuestion throws when the tenant's qa flag is off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { qa: false });
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await expect(
    asUser(t, alice).mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001", text: "why?" }),
  ).rejects.toThrow();
});

test("askQuestion succeeds when qa is on and on the default site", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await seedTopic(t, alice, "spanish");
  await asUser(t, alice).mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001", text: "on tenant" });
  await asUser(t, alice).mutation(api.capture.askQuestion, { topicSlug: "spanish", lessonKey: "0001", text: "default" });
  const onTenant = await asUser(t, alice).query(api.capture.myQuestions, { topicSlug: "hindi" });
  const dflt = await asUser(t, alice).query(api.capture.myQuestions, { topicSlug: "spanish" });
  expect(onTenant).toHaveLength(1);
  expect(dflt).toHaveLength(1);
});

// ---- translations flag → tryAcquireTranslation ------------------------------

test("tryAcquireTranslation throws when the tenant's translations flag is off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { translations: false });
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await expect(
    asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).rejects.toThrow();
});

test("tryAcquireTranslation acquires when translations is on (and on the default site)", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi", "upf");
  await seedTopic(t, alice, "spanish");
  await expect(
    asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "hindi", lang: "es" }),
  ).resolves.toMatchObject({ acquired: true });
  await expect(
    asUser(t, alice).mutation(internal.translate.tryAcquireTranslation, { topicSlug: "spanish", lang: "es" }),
  ).resolves.toMatchObject({ acquired: true });
});

// ---- seeding flag → seedTopic (gated by the CALLER's own tenantSlug) ---------

test("seedTopic throws when the caller's own tenant seeding flag is off", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf", { seeding: false });
  const alice = await seedUser(t, "alice@example.com", "upf");
  await expect(
    asUser(t, alice).mutation(api.content.seedTopic, { title: "New Course", why: "because" }),
  ).rejects.toThrow();
});

test("seedTopic succeeds when the caller's tenant seeding is on, and for a default-site user", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t, "upf");
  const scoped = await seedUser(t, "scoped@example.com", "upf");
  const dflt = await seedUser(t, "default@example.com");
  await expect(
    asUser(t, scoped).mutation(api.content.seedTopic, { title: "Scoped Course", why: "y" }),
  ).resolves.toMatchObject({ slug: expect.any(String) });
  await expect(
    asUser(t, dflt).mutation(api.content.seedTopic, { title: "Default Course", why: "y" }),
  ).resolves.toMatchObject({ slug: expect.any(String) });
});
