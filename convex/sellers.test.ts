/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Selling requires a configured PayFast rail (merchant credentials + passphrase)
// — pricing is refused without them, so the tests provide the sandbox trio.
beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";
});

// Paid marketplace (PayFast rail — .scratch/payfast-payments): the **Seller**
// side. Two seams are tested here:
//   1. Seller gating: the can-sell grant/revoke is Admin-only; the self status
//      query walks not-granted → granted-no-payout-details → ready as the grant
//      lands and the payout bank details are saved.
//   2. Pricing: only a ready Seller (grant + bank details) who OWNS a `completed`
//      course can price one of its held Editions; a non-owner, a not-ready
//      Seller, and an unfinished course are all refused. Pricing an Edition
//      makes it paid (the flag the access resolver reads).
// Bank details are saved in-app by the granted author (savePayoutDetails) —
// Admin-readable via listSellers (needed to pay out) but never returned by any
// non-admin query.

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

  // Bank details land → ready.
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");
});

test("PAYFAST_DISABLED pauses selling platform-wide — even a ready Seller sees payments-unconfigured", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");

  // Flip the kill switch: the rail is still provisioned (the beforeAll trio),
  // but selling is off for everyone — the price control shows "not available".
  process.env.PAYFAST_DISABLED = "true";
  try {
    expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("payments-unconfigured");
  } finally {
    delete process.env.PAYFAST_DISABLED;
  }
});

// ---- Seam — payout bank details ------------------------------------------------

test("a granted author can save and update bank details; a non-granted user cannot", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const stranger = await seedUser(t, "stranger@example.com");

  // Not granted (and not signed in) → refused.
  await expect(asUser(t, stranger).mutation(api.sellers.savePayoutDetails, PAYOUT)).rejects.toThrow();
  await expect(t.mutation(api.sellers.savePayoutDetails, PAYOUT)).rejects.toThrow();

  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  let [row] = await sellerRows(t, seller);
  expect(row!.payout).toEqual(PAYOUT);

  // Update in place (a correction) — still one row, new details.
  const updated = { ...PAYOUT, accountNumber: "62999999999" };
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, updated);
  [row] = await sellerRows(t, seller);
  expect(row!.payout).toEqual(updated);
  expect(await sellerRows(t, seller)).toHaveLength(1);
});

test("savePayoutDetails rejects blank or non-numeric account/branch fields", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });

  await expect(
    asUser(t, seller).mutation(api.sellers.savePayoutDetails, { ...PAYOUT, accountHolder: "   " }),
  ).rejects.toThrow();
  await expect(
    asUser(t, seller).mutation(api.sellers.savePayoutDetails, { ...PAYOUT, accountNumber: "not-digits" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, seller).mutation(api.sellers.savePayoutDetails, { ...PAYOUT, branchCode: "12ab" }),
  ).rejects.toThrow();
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("granted-no-payout-details");
});

test("bank details are Admin-readable via listSellers, and in no non-admin payload", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);

  // The Admin sees the details (they have to EFT the author's share somewhere).
  expect(await asUser(t, admin).query(api.sellers.listSellers, {})).toEqual([
    { email: "seller@example.com", status: "ready", payout: PAYOUT },
  ]);
  // Never logged is a code-review property; never *returned* is structural — the
  // sellers table is read only by listSellers (admin-gated) and sellerStatus.
  // A non-admin (the Seller themself included) cannot read them back.
  await expect(asUser(t, seller).query(api.sellers.listSellers, {})).rejects.toThrow();
  // The only self-facing read is the bare status string — no details in it.
  expect(await asUser(t, seller).query(api.sellers.sellerStatus, {})).toBe("ready");
});

test("listSellers is Admin-only and reports each Seller's status", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "seller@example.com" });

  await expect(asUser(t, seller).query(api.sellers.listSellers, {})).rejects.toThrow();
  expect(await asUser(t, admin).query(api.sellers.listSellers, {})).toEqual([
    { email: "seller@example.com", status: "granted-no-payout-details", payout: null },
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

test("pricing is ZAR-only — any other currency is rejected", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await makeReadySeller(t, owner);
  const topicId = await seedTopic(t, owner, "hindi", "completed");
  await addLesson(t, topicId, "0001", 1);

  for (const currency of ["usd", "USD", "eur", "gbp"]) {
    await expect(
      asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 50000, currency }),
    ).rejects.toThrow();
  }
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([]);

  // ZAR (any casing) is accepted and normalised.
  await asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 50000, currency: "ZAR" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 50000, currency: "zar" },
  ]);
});

test("selling is disabled while PayFast isn't configured — pricing refused, status says why", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await makeReadySeller(t, owner);
  const topicId = await seedTopic(t, owner, "hindi", "completed");
  await addLesson(t, topicId, "0001", 1);

  // Simulate a deployment whose PayFast env vars haven't been provisioned yet.
  const saved = {
    id: process.env.PAYFAST_MERCHANT_ID,
    key: process.env.PAYFAST_MERCHANT_KEY,
    pass: process.env.PAYFAST_PASSPHRASE,
  };
  delete process.env.PAYFAST_MERCHANT_ID;
  delete process.env.PAYFAST_MERCHANT_KEY;
  delete process.env.PAYFAST_PASSPHRASE;
  try {
    // Even a ready Seller can't price — a listing checkout can't sell must never exist.
    await expect(
      asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 50000, currency: "zar" }),
    ).rejects.toThrow(/[Ss]elling is disabled/);
    // The self-status query says why, so the UI shows the reason, not a dead control.
    expect(await asUser(t, owner).query(api.sellers.sellerStatus, {})).toBe("payments-unconfigured");
    // Un-listing stays allowed — an owner can always stop selling.
    await asUser(t, owner).mutation(api.market.clearEditionPrice, { topicSlug: "hindi", lang: "en" });
  } finally {
    if (saved.id) process.env.PAYFAST_MERCHANT_ID = saved.id;
    if (saved.key) process.env.PAYFAST_MERCHANT_KEY = saved.key;
    if (saved.pass) process.env.PAYFAST_PASSPHRASE = saved.pass;
  }

  // The moment the env vars exist again, selling enables itself — no redeploy flag.
  expect(await asUser(t, owner).query(api.sellers.sellerStatus, {})).toBe("ready");
  await asUser(t, owner).mutation(api.market.setEditionPrice, { topicSlug: "hindi", lang: "en", amount: 50000, currency: "zar" });
  expect(await t.query(api.market.editionPricing, { topicSlug: "hindi" })).toEqual([
    { lang: "en", amount: 50000, currency: "zar" },
  ]);
  void topicId;
});
