/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The seller-minted voucher rail (ADR 0029, the vouchers map). Everything here is
// asserted through the Convex function boundary - what a query returns, whether a
// mutation throws, and what rows exist afterwards - never on how a code is
// generated or how a mutation is structured inside.
//
// Fixtures follow `convex/eft.test.ts`: `users` rows as auth writes them,
// `whitelist` rows as `whitelist.seedEmail` writes them, and everything else
// through the production mutation that owns it. A `vouchers` row is NEVER
// hand-inserted - a test mints a batch and reads the codes back, so the only
// writer that exists is the one being exercised.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedSysAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await seedUser(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}

const PAYOUT = { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };

const ORG = { orgName: "The Party", orgContact: "billing@party.example.org" };

// A Seller who may mint: the admin grants can-sell, the Seller saves payout
// details, and the OWNER publishes their own completed course. Only `topics` and
// `lessons` are hand-inserted (the shape `content.seedTopic` and the Routine's
// publish write), following sellers.test.ts and eft.test.ts.
//
// Deliberately NOT priced. A batch needs a PUBLISHED Edition, not a priced one -
// the Seller states the total - so pricing it here would test a gate that does not
// exist and would drag the PayFast env into a rail that never touches it.
async function seedSeller(t: ReturnType<typeof convexTest>, admin: Id<"users">, email: string, slug: string) {
  const seller = await seedUser(t, email);
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: seller, slug, title: slug, status: "completed" as const }),
  );
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "Lesson 1", htmlStorageId });
  });
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  await asUser(t, seller).mutation(api.catalogue.setEditionPublished, { topicSlug: slug, lang: "en", published: true });
  return { seller, topicId };
}

async function voucherRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("vouchers").take(200));
}
async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(200));
}

const MINT = { topicSlug: "hindi", lang: "en", seats: 3, total: 500000, ...ORG };

// ---- Minting (ticket 02) ------------------------------------------------------

test("minting a batch writes N codes and exactly one unpaid batch ledger row", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");

  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);

  const batch = await t.run((ctx) => ctx.db.get(batchId));
  expect(batch).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    seats: 3,
    total: 500000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
    voided: false,
  });

  // N codes, all unredeemed, all distinct, and all in the shape a member can read
  // off a card: `MYC-7K4Q-2XR9`, with no O/0/I/1 anywhere in them.
  const codes = await voucherRows(t);
  expect(codes).toHaveLength(3);
  expect(new Set(codes.map((c) => c.code)).size).toBe(3);
  for (const c of codes) {
    expect(c.batchId).toEqual(batchId);
    expect(c.redeemedAt).toBeUndefined();
    expect(c.code).toMatch(/^MYC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  }

  // ONE Ledger row for the whole batch, however many seats it carries - the money
  // event is the batch, not a redemption. `fee: 0` because no gateway took a cut,
  // and `buyerEmail` is the ORGANISATION's billing contact, not a member's.
  const ledger = await ledgerRows(t);
  expect(ledger).toHaveLength(1);
  expect(ledger[0]).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    buyerEmail: "billing@party.example.org",
    gross: 500000,
    fee: 0,
    net: 500000,
    sellerShare: 250000,
    platformShare: 250000,
    kind: "batch",
    status: "unpaid",
  });
  expect(ledger[0]).not.toHaveProperty("pfPaymentId");
  expect(ledger[0]).not.toHaveProperty("eftRef");
  expect(batch!.ledgerId).toEqual(ledger[0]!._id);
});

test("a freshly minted batch is invisible to payouts - the seats are live, the money is not", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);

  // The guard ticket 01 landed, now exercised by a real writer rather than a
  // hand-seeded row: `owedPayouts` reads the `by_status` index for `owed`.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);
});

test("minting is refused for anybody but a ready Seller who owns a published edition", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  // No `sellers` row at all - can-sell was never granted.
  const stranger = await seedUser(t, "stranger@example.com");
  await expect(asUser(t, stranger).mutation(api.vouchers.mintBatch, MINT)).rejects.toThrow();

  // Granted, but no payout details: the platform must never issue a seat it
  // cannot pay anybody for.
  const halfway = await seedUser(t, "halfway@example.com");
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "halfway@example.com" });
  await expect(asUser(t, halfway).mutation(api.vouchers.mintBatch, MINT)).rejects.toThrow();

  // A ready Seller who does not own THIS course. Nobody can sell somebody else's
  // Editions, and the interesting half is that being a Seller is not enough.
  const other = await seedSeller(t, admin, "other@example.com", "urdu");
  await expect(asUser(t, other.seller).mutation(api.vouchers.mintBatch, MINT)).rejects.toThrow();

  // An unpublished Edition - the owner has not listed it, so there is nothing to
  // sell seats to.
  await expect(
    asUser(t, seller).mutation(api.vouchers.mintBatch, { ...MINT, lang: "es" }),
  ).rejects.toThrow();

  // The sysadmin. The money role and the selling role are separate: they log the
  // cash and never mint or read a code.
  await expect(asUser(t, admin).mutation(api.vouchers.mintBatch, MINT)).rejects.toThrow();

  // And a Guest, who has no account to attribute the batch to.
  await expect(t.mutation(api.vouchers.mintBatch, MINT)).rejects.toThrow();

  // Nothing above wrote anything.
  expect(await voucherRows(t)).toEqual([]);
  expect(await ledgerRows(t)).toEqual([]);
});

test("minting refuses a nonsense seat count, total or organisation", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const mint = (args: Partial<typeof MINT>) => asUser(t, seller).mutation(api.vouchers.mintBatch, { ...MINT, ...args });

  await expect(mint({ seats: 0 })).rejects.toThrow();
  await expect(mint({ seats: 2.5 })).rejects.toThrow();
  await expect(mint({ seats: 100000 })).rejects.toThrow();
  await expect(mint({ total: 0 })).rejects.toThrow();
  // A blank billing contact would put an anonymous money event in the payouts view.
  await expect(mint({ orgContact: "   " })).rejects.toThrow();
  await expect(mint({ orgName: "" })).rejects.toThrow();

  expect(await voucherRows(t)).toEqual([]);
  expect(await ledgerRows(t)).toEqual([]);
});
