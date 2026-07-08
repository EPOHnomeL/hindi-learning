/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Paid marketplace — Slice 2 (ADR 0016): the **Seller** side. Two seams are
// tested here (Stripe mocked at the action boundary — no test calls Stripe):
//   1. Seller gating: the can-sell grant/revoke is Admin-only; the self status
//      query walks not-granted → granted → onboarding-incomplete → ready as the
//      grant lands and the (internal) Stripe flags update.
//   2. Pricing: only a payouts-enabled Seller who OWNS a `completed` course can
//      price one of its held Editions; a non-owner, a non-ready Seller, and an
//      unfinished course are all refused. Pricing an Edition makes it paid (the
//      flag Slice 1's access resolver reads), tied back to the reader seam.

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
// Make an existing account a fully-onboarded (payouts-enabled) Seller directly —
// the state the Stripe onboarding flow leaves behind, without invoking Stripe.
async function makeReadySeller(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  await t.run((ctx) =>
    ctx.db.insert("sellers", { userId, stripeAccountId: "acct_ready", chargesEnabled: true, payoutsEnabled: true }),
  );
}
async function sellerRows(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db.query("sellers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  );
}

// ---- Seam 3 — seller gating: the can-sell grant -----------------------------

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

  // Admin grants → the row exists; status advances to granted-not-onboarded.
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("granted-not-onboarded");

  // Idempotent: a second grant makes no second row.
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await sellerRows(t, seller)).toHaveLength(1);
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

test("sellerStatus walks not-granted → granted → onboarding-incomplete → ready", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");

  // Unauthenticated callers are simply not-granted.
  expect(await t.query(api.sellers.sellerStatus, {})).toBe("not-granted");
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("not-granted");

  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("granted-not-onboarded");

  // Onboarding starts: the action attaches a connected account (internal mutation).
  await t.mutation(internal.sellers.attachStripeAccount, { userId: seller, stripeAccountId: "acct_1" });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("onboarding-incomplete");

  // Stripe reports the account fully enabled (the account.updated webhook).
  await t.mutation(internal.sellers.updateAccountFlags, {
    stripeAccountId: "acct_1",
    chargesEnabled: true,
    payoutsEnabled: true,
  });
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");
});

test("Stripe internal mutations: attach doesn't overwrite/leak, flags no-op on unknown account", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const stranger = await seedUser(t, "stranger@example.com");

  // Attaching before a grant exists is refused (a revoke mid-onboarding wins).
  await expect(
    t.mutation(internal.sellers.attachStripeAccount, { userId: stranger, stripeAccountId: "acct_x" }),
  ).rejects.toThrow();

  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  await t.mutation(internal.sellers.attachStripeAccount, { userId: seller, stripeAccountId: "acct_1" });
  // A second attach never swaps the connected account (reuse, not re-create).
  await t.mutation(internal.sellers.attachStripeAccount, { userId: seller, stripeAccountId: "acct_2" });
  const [row] = await sellerRows(t, seller);
  expect(row!.stripeAccountId).toBe("acct_1");

  // Flag update for an account no Seller holds is a silent no-op (not an error).
  await t.mutation(internal.sellers.updateAccountFlags, {
    stripeAccountId: "acct_nobody",
    chargesEnabled: true,
    payoutsEnabled: true,
  });
});

test("listSellers is Admin-only and reports each Seller's status", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });

  await expect(asUser(t, seller).query(api.sellers.listSellers, {})).rejects.toThrow();
  expect(await asUser(t, admin).query(api.sellers.listSellers, {})).toEqual([
    { email: "seller@example.com", status: "granted-not-onboarded" },
  ]);
});

// ---- Seam 3 — seller gating: pricing (replaces Slice 1's Admin price) --------

test("only a ready Seller who owns a completed course can price a held Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const other = await seedUser(t, "other@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);

  const setPrice = { topicSlug: "hindi", lang: "en", amount: 500, currency: "usd" };

  // Not a Seller at all → refused.
  await expect(asUser(t, owner).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // A ready Seller who does NOT own the course → refused ("not your course").
  await makeReadySeller(t, other);
  await expect(asUser(t, other).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // The owner, granted but NOT payouts-enabled → refused.
  await t.run((ctx) =>
    ctx.db.insert("sellers", { userId: owner, stripeAccountId: "acct_o", chargesEnabled: false, payoutsEnabled: false }),
  );
  await expect(asUser(t, owner).mutation(api.market.setEditionPrice, setPrice)).rejects.toThrow();

  // Owner becomes payouts-enabled → now the price sticks and the Edition is paid.
  await t.run((ctx) =>
    ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", owner))
      .unique()
      .then((r) => ctx.db.patch(r!._id, { payoutsEnabled: true, chargesEnabled: true })),
  );
  await asUser(t, owner).mutation(api.market.setEditionPrice, { ...setPrice, currency: "USD" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 500, currency: "usd" }, // currency normalised lower-case
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
    asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "wip", lang: "en", amount: 500, currency: "usd" }),
  ).rejects.toThrow();

  // Completed course, but a language the owner doesn't hold (no translation) → refused.
  await seedTopic(t, owner, "hindi", "completed").then((id) => addLesson(t, id, "0001", 1));
  await expect(
    asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "es", amount: 500, currency: "usd" }),
  ).rejects.toThrow();
  // The English source IS held → allowed.
  await asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 500, currency: "usd" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 500, currency: "usd" },
  ]);

  // A non-owner cannot clear a price either.
  const stranger = await seedUser(t, "stranger@example.com");
  await expect(
    asUser(t, stranger).mutation(api.market.clearEditionPrice, { topicSlug: "hindi", lang: "en" }),
  ).rejects.toThrow();
});
