/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The shared capped Access Code rail (ADR 0031, the shared-access-codes map).
// Everything here is asserted through the Convex function boundary: what a query
// returns, whether a mutation throws, and what rows exist afterwards. Never on how
// a code is generated or how a mutation is structured inside.
//
// Fixtures follow `convex/vouchers.test.ts` and `convex/eft.test.ts`: `users` rows
// as auth writes them, `whitelist` rows as `whitelist.seedEmail` writes them, and
// everything else through the production mutation that owns it. **An `accessCodes`
// or `seats` row is NEVER hand-inserted** - a test mints a code and joins through
// the real credentials provider, so the only writers that exist are the ones being
// exercised.

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
// details, and the owner publishes their own completed course. Only `topics` and
// `lessons` are hand-inserted, following `vouchers.test.ts`.
//
// Deliberately NOT priced. A shared code needs a PUBLISHED Edition, not a priced
// one - the Seller states the per-seat price - so pricing it here would test a gate
// that does not exist.
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

const MINT = { topicSlug: "hindi", lang: "en", capacity: 3, pricePerSeat: 15000, ...ORG };

async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(200));
}
async function seatRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("seats").take(200));
}

// ---- Minting (ticket 02) ------------------------------------------------------

test("minting writes one code row, no ledger row, and no seats", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");

  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  const row = await t.run((ctx) => ctx.db.get(accessCodeId));
  expect(row).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    code,
    capacity: 3,
    pricePerSeat: 15000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
  });
  // Absent until the code stops. **This is the structural difference from a
  // Voucher Batch**, which writes its Ledger row at mint because its total is known
  // then: an Access Code's total is unknown until somebody ends the agreement.
  expect(row).not.toHaveProperty("stoppedAt");
  expect(row).not.toHaveProperty("ledgerId");
  expect(row).not.toHaveProperty("paymentRef");
  expect(await ledgerRows(t)).toEqual([]);
  expect(await seatRows(t)).toEqual([]);

  // `GRP-7K4-Q2X-9MB`: a different SHAPE from a voucher's `MYC-7K4Q-2XR9`, not just
  // a different prefix, because both rails can be live on one Edition at once.
  // No O, I, 0 or 1 anywhere in it: this code gets read out loud at a meeting.
  expect(code).toMatch(/^GRP(-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}){3}$/);
});

test("a freshly minted code is invisible to payouts and to the sales report", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  // Nothing to be invisible to yet, which is the point: no money event exists.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);
  expect(await asUser(t, admin).query(api.sales.report, {})).toEqual([]);
});

test("minting is refused for anybody but a ready Seller who owns a published edition", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const stranger = await seedUser(t, "stranger@example.com");

  // Signed out.
  await expect(t.mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();
  // Signed in, but not this course's owner - asserted SERVER-side, not by which
  // Editions a page lists.
  await expect(asUser(t, stranger).mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();

  // Owner, granted, with payout details, but the Edition is unpublished.
  await asUser(t, seller).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: false,
  });
  await expect(asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();
});

test("the cap and the per-seat price are both bounded", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const mint = (args: Partial<typeof MINT>) =>
    asUser(t, seller).mutation(api.accessCodes.mintAccessCode, { ...MINT, ...args });

  await expect(mint({ capacity: 0 })).rejects.toThrow();
  await expect(mint({ capacity: -1 })).rejects.toThrow();
  await expect(mint({ capacity: 2.5 })).rejects.toThrow();
  await expect(mint({ capacity: 100000 })).rejects.toThrow();
  // Zero is refused as well as negative: a free shared code is a free published
  // Edition, and a R0.00 settlement line is a puzzle for the operator.
  await expect(mint({ pricePerSeat: 0 })).rejects.toThrow();
  await expect(mint({ pricePerSeat: -100 })).rejects.toThrow();
  // The organisation and its billing contact are what the operator invoices.
  await expect(mint({ orgName: "  " })).rejects.toThrow();
  await expect(mint({ orgContact: "" })).rejects.toThrow();
  expect(await seatRows(t)).toEqual([]);
});

test("one Seller may mint two codes for the same edition - two organisations are two bills", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  const one = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  const two = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, {
    ...MINT,
    orgName: "Another Party",
    orgContact: "billing@another.example.org",
    pricePerSeat: 20000,
  });

  expect(one.code).not.toEqual(two.code);
  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine).toHaveLength(2);
  expect(mine.map((c) => c.orgName).sort()).toEqual(["Another Party", "The Party"]);
});

test("myAccessCodes lists the caller's own codes with a derived count, and never another Seller's", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { seller: other } = await seedSeller(t, admin, "other@example.com", "urdu");

  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await asUser(t, other).mutation(api.accessCodes.mintAccessCode, {
    ...MINT,
    topicSlug: "urdu",
    orgName: "Someone Else",
  });

  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    accessCodeId,
    topicSlug: "hindi",
    courseTitle: "hindi",
    lang: "en",
    code,
    capacity: 3,
    // Nobody has joined, so the derived count is zero and so is the running total.
    taken: 0,
    pricePerSeat: 15000,
    runningTotal: 0,
    orgName: "The Party",
    stoppedAt: null,
    paymentRef: null,
  });

  // Signed out sees nothing rather than throwing: the Seller's dialog mounts this
  // query before auth has settled.
  expect(await t.query(api.accessCodes.myAccessCodes, {})).toEqual([]);
});
