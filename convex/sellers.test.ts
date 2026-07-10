/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Paid marketplace (PayFast rail — .scratch/payfast-payments): the **Seller**
// side. Two seams are tested here:
//   1. Seller gating: the can-sell grant/revoke is Admin-only; the self status
//      query walks not-granted → granted-no-payout-details → ready as the grant
//      lands and the payout bank details are saved.
//   2. Pricing: only a ready Seller (grant + bank details) who OWNS a `completed`
//      course can price one of its held Editions; a non-owner, a not-ready
//      Seller, and an unfinished course are all refused. Pricing an Edition
//      makes it paid (the flag the access resolver reads).
// (The bank-details save/read mutations land with ticket 02 — until then the
// tests seed payout details directly, the state that mutation leaves behind.)

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
async function seedTopic(
  t: ReturnType<typeof convexTest>,
  ownerId: Id<"users">,
  slug: string,
  status: "active" | "completed" = "completed",
) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status }));
}
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number) {
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob([`<p>en ${key}</p>`], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, htmlStorageId });
  });
}
const PAYOUT = { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };
// Make an existing account a ready Seller directly — the state the grant + the
// bank-details save leave behind.
async function makeReadySeller(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  await t.run((ctx) => ctx.db.insert("sellers", { userId, payout: PAYOUT }));
}
async function sellerRows(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db.query("sellers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  );
}

// ---- Seam — seller gating: the can-sell grant --------------------------------

test("grantCanSell is Admin-only, idempotent, and needs an existing account", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const bob = await seedUser(t, "bob@example.com");

  // A non-Admin cannot grant.
  await expect(
    asUser(t, bob).mutation(api.sellers.grantCanSell, { email: "seller@example.com" }),
  ).rejects.toThrow();
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("not-granted");

  // Granting to an email with no account is refused (you grant a User, not an address).
  await expect(
    asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "ghost@example.com" }),
  ).rejects.toThrow();

  // Admin grants → the row exists; status advances to granted-no-payout-details.
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("granted-no-payout-details");

  // Idempotent: a second grant makes no second row.
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await sellerRows(t, seller)).toHaveLength(1);
});

test("a repeat grant never clobbers saved bank details", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await makeReadySeller(t, seller); // granted + bank details on file

  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  const [row] = await sellerRows(t, seller);
  expect(row!.payout).toEqual(PAYOUT);
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");
});

test("revokeCanSell is Admin-only, removes the grant, and leaves Entitlements intact", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedTopic(t, seller, "hindi");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "en" }));

  // A non-Admin cannot revoke.
  await expect(
    asUser(t, seller).mutation(api.sellers.revokeCanSell, { email: "seller@example.com" }),
  ).rejects.toThrow();

  // Admin revokes → the grant is gone (status back to not-granted)…
  await asUser(t, admin).mutation(api.sellers.revokeCanSell, { email: "seller@example.com" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("not-granted");
  expect(await sellerRows(t, seller)).toHaveLength(0);

  // …but the buyer's already-sold Entitlement survives.
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents).toHaveLength(1);

  // Revoke of a never-granted account is a no-op.
  await asUser(t, admin).mutation(api.sellers.revokeCanSell, { email: "buyer@example.com" });
});

test("sellerStatus walks not-granted → granted-no-payout-details → ready", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");

  // Unauthenticated callers are simply not-granted.
  expect(await t.query(api.sellers.sellerStatus, {})).toBe("not-granted");
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("not-granted");

  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("granted-no-payout-details");

  // Bank details land (ticket 02's mutation; seeded directly here) → ready.
  await t.run(async (ctx) => {
    const row = await ctx.db.query("sellers").withIndex("by_user", (q) => q.eq("userId", seller)).unique();
    await ctx.db.patch(row!._id, { payout: PAYOUT });
  });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");
});

test("listSellers is Admin-only and reports each Seller's status", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });

  await expect(asUser(t, seller).query(api.sellers.listSellers, {})).rejects.toThrow();
  expect(await asUser(t, admin).query(api.sellers.listSellers, {})).toEqual([
    { email: "seller@example.com", status: "granted-no-payout-details" },
  ]);
});

// ---- Seam — seller gating: pricing --------------------------------------------

test("only a ready Seller who owns a completed course can price a held Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const other = await seedUser(t, "other@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);

  const setPrice = { topicSlug: "hindi", lang: "en", amount: 50000, currency: "zar" };

  // Not a Seller at all → refused.
  await expect(asUser(t, owner).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // A ready Seller who does NOT own the course → refused ("not your course").
  await makeReadySeller(t, other);
  await expect(asUser(t, other).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // The owner, granted but with NO payout bank details → refused.
  await t.run((ctx) => ctx.db.insert("sellers", { userId: owner }));
  await expect(asUser(t, owner).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // Owner saves bank details → now the price sticks and the Edition is paid.
  await t.run((ctx) =>
    ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", owner))
      .unique()
      .then((r) => ctx.db.patch(r!._id, { payout: PAYOUT })),
  );
  await asUser(t, owner).mutation(api.market.setEditionPrice, { ...setPrice, currency: "ZAR" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 50000, currency: "zar" }, // currency normalised lower-case
  ]);

  // Tied to the reader seam: an unentitled caller now sees the paygate (locked past Preview).
  expect(await asUser(t, other).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  // Owner clears it → free again.
  await asUser(t, owner).mutation(api.market.clearEditionPrice, { topicSlug: "hindi", lang: "en" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([]);
});

test("pricing is refused on an unfinished course and on an Edition the owner doesn't hold", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await makeReadySeller(t, owner);

  // Active (not completed) course → refused even for a ready Seller.
  const activeTopic = await seedTopic(t, owner, "wip", "active");
  await addLesson(t, activeTopic, "0001", 1);
  await expect(
    asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "wip", lang: "en", amount: 50000, currency: "zar" }),
  ).rejects.toThrow();

  // Completed course, but a language the owner doesn't hold (no translation) → refused.
  await seedTopic(t, owner, "hindi", "completed").then((id) => addLesson(t, id, "0001", 1));
  await expect(
    asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "es", amount: 50000, currency: "zar" }),
  ).rejects.toThrow();
  // The English source IS held → allowed.
  await asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 50000, currency: "zar" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 50000, currency: "zar" },
  ]);

  // A non-owner cannot clear a price either.
  const stranger = await seedUser(t, "stranger@example.com");
  await expect(
    asUser(t, stranger).mutation(api.market.clearEditionPrice, { topicSlug: "hindi", lang: "en" }),
  ).rejects.toThrow();
});
