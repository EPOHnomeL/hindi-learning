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

// ---- Redemption (ticket 03) ---------------------------------------------------

// The codes of a batch, straight from the table. Reading them back is how every
// redemption test gets a code: `vouchers` rows are never hand-inserted, so the
// only writer exercised is the real one.
async function codesOf(t: ReturnType<typeof convexTest>, batchId: Id<"voucherBatches">) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId))
      .collect(),
  );
  return rows.map((r) => r.code);
}
async function voucherByCode(t: ReturnType<typeof convexTest>, code: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first(),
  );
}

test("redeeming mints an Entitlement that records nothing about the redeemer", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const [code] = await codesOf(t, batchId);
  const member = await seedUser(t, "member@example.com");

  const where = await asUser(t, member).mutation(api.vouchers.redeem, { code: code! });
  expect(where).toEqual({ topicSlug: "hindi", lang: "en", courseTitle: "hindi" });

  const held = await t.run((ctx) =>
    ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", member))
      .collect(),
  );
  expect(held).toHaveLength(1);
  expect(held[0]).toMatchObject({ userId: member, topicId, lang: "en" });
  // **The privacy promise, asserted positively** (ADR 0029). A voucher seat is
  // byte-identical to an Admin comp: no payment provenance and no voucher
  // provenance, so nobody can list the redeemers by elimination. A refactor that
  // adds a `batchId` back here must fail this test - it is not redundant.
  expect(held[0]).not.toHaveProperty("pfPaymentId");
  expect(held[0]).not.toHaveProperty("eftRef");
  expect(Object.keys(held[0]!).sort()).toEqual(["_creationTime", "_id", "lang", "topicId", "userId"]);

  // The voucher records that it was spent and nothing else - no user id.
  const spent = await voucherByCode(t, code!);
  expect(spent!.redeemedAt).toEqual(expect.any(Number));
  expect(Object.keys(spent!).sort()).toEqual(["_creationTime", "_id", "batchId", "code", "redeemedAt"]);
});

test("a code is accepted however it was typed off a card", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const [code] = await codesOf(t, batchId);
  const member = await seedUser(t, "member@example.com");

  // Lower case, stray spaces and missing separators are all the same code: they
  // read it off a printed card or a phone screen with no instructions.
  const mangled = "  " + code!.toLowerCase().replace(/-/g, " ") + " ";
  await asUser(t, member).mutation(api.vouchers.redeem, { code: mangled });
  expect((await voucherByCode(t, code!))!.redeemedAt).toEqual(expect.any(Number));
});

test("redemption is refused for a Guest, an unknown code and a spent one", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const [code] = await codesOf(t, batchId);
  const member = await seedUser(t, "member@example.com");
  const other = await seedUser(t, "other@example.com");

  // A Guest: redemption is auth-first and mints onto the signed-in account, which
  // is the hole ADR 0021 closed and this rail must not reopen.
  await expect(t.mutation(api.vouchers.redeem, { code: code! })).rejects.toThrow();
  // A dud code, distinguishable from a spent one so a typo is diagnosable.
  await expect(asUser(t, member).mutation(api.vouchers.redeem, { code: "MYC-AAAA-BBBB" })).rejects.toThrow(/voucher\/code-unknown/);

  await asUser(t, member).mutation(api.vouchers.redeem, { code: code! });

  // A second redemption of the same code changes nothing - and who spent it is
  // permanently unanswerable, by design.
  await expect(asUser(t, other).mutation(api.vouchers.redeem, { code: code! })).rejects.toThrow(/voucher\/code-used/);
  const seats = await t.run((ctx) => ctx.db.query("entitlements").take(50));
  expect(seats).toHaveLength(1);
});

test("redemption refuses WITHOUT consuming when the caller already has access", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const codes = await codesOf(t, batchId);
  const unspent = async (code: string) => (await voucherByCode(t, code))!.redeemedAt;

  // 1. Already entitled - bought the Edition, or was comped it.
  const buyer = await seedUser(t, "buyer@example.com");
  await asUser(t, admin).mutation(api.market.grantEntitlement, {
    email: "buyer@example.com",
    topicSlug: "hindi",
    lang: "en",
  });
  await expect(asUser(t, buyer).mutation(api.vouchers.redeem, { code: codes[0]! })).rejects.toThrow(/voucher\/already-have-access/);
  expect(await unspent(codes[0]!)).toBeUndefined();

  // 2. A grandfathered Enrollment on that Edition - they joined while it was free.
  const joiner = await seedUser(t, "joiner@example.com");
  await t.run((ctx) => ctx.db.insert("enrollments", { userId: joiner, topicId, lang: "en" }));
  await expect(asUser(t, joiner).mutation(api.vouchers.redeem, { code: codes[1]! })).rejects.toThrow(/voucher\/already-have-access/);
  expect(await unspent(codes[1]!)).toBeUndefined();

  // 3. The owner of the course, who cannot buy a seat on their own Edition.
  await expect(asUser(t, seller).mutation(api.vouchers.redeem, { code: codes[2]! })).rejects.toThrow(/voucher\/already-have-access/);
  expect(await unspent(codes[2]!)).toBeUndefined();

  // Every seat is still there for somebody who actually needs one: the
  // organisation paid for three and still has three.
  const member = await seedUser(t, "member@example.com");
  await asUser(t, member).mutation(api.vouchers.redeem, { code: codes[0]! });
  expect(await unspent(codes[0]!)).toEqual(expect.any(Number));
});

test("a code works whatever the batch's payment state - the cash log is not a gate", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const [code] = await codesOf(t, batchId);
  const member = await seedUser(t, "member@example.com");

  // The money has not arrived: the Ledger row is `unpaid` and nobody is owed a
  // thing. The seat is live anyway, which is the opposite of the EFT rail and of
  // the intuitive assumption - hence this test.
  expect((await ledgerRows(t))[0]).toMatchObject({ status: "unpaid" });
  await asUser(t, member).mutation(api.vouchers.redeem, { code: code! });
  expect(await voucherByCode(t, code!)).toMatchObject({ redeemedAt: expect.any(Number) });
});

// ---- The sysadmin's cash log (ticket 04) ---------------------------------------

test("the pending queue shows the sysadmin everything but the codes", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);

  const pending = await asUser(t, admin).query(api.vouchers.pendingBatches, {});
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({
    batchId,
    courseTitle: "hindi",
    lang: "en",
    sellerEmail: "author@example.com",
    seats: 3,
    total: 500000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
  });
  // The separation between the money role and the selling role is what this query
  // CAN say, not what a page chooses to render: the returns validator has no code
  // field, so no UI change can leak one.
  const codes = await codesOf(t, batchId);
  expect(JSON.stringify(pending)).not.toContain(codes[0]);

  // The Seller, and anybody else, is refused - reconciling money is not their job.
  await expect(asUser(t, seller).query(api.vouchers.pendingBatches, {})).rejects.toThrow();
  await expect(t.query(api.vouchers.pendingBatches, {})).rejects.toThrow();
});

test("logging the cash makes the share payable, is idempotent, and touches no code", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const before = await codesOf(t, batchId);

  // The interesting negative: the Seller cannot log their own batch's payment, so
  // the boundary between selling and being paid is server-enforced.
  await expect(
    asUser(t, seller).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-993" }),
  ).rejects.toThrow();
  // And a blank reference is refused - the whole point is the statement line.
  await expect(
    asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "  " }),
  ).rejects.toThrow();
  expect(await asUser(t, admin).query(api.vouchers.pendingBatches, {})).toHaveLength(1);

  await asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-993" });
  expect(await t.run((ctx) => ctx.db.get(batchId))).toMatchObject({ paymentRef: "FNB-993" });
  // Off the queue, and now payable.
  expect(await asUser(t, admin).query(api.vouchers.pendingBatches, {})).toEqual([]);
  expect((await ledgerRows(t))[0]).toMatchObject({ status: "owed" });

  // Logging twice keeps the ORIGINAL reference and moves nothing a second time.
  await asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-OOPS" });
  expect(await t.run((ctx) => ctx.db.get(batchId))).toMatchObject({ paymentRef: "FNB-993" });
  expect(await ledgerRows(t)).toHaveLength(1);

  // Nothing in the cash log reads, writes or invalidates a code: the seats have
  // been live since minting and are unaffected either way.
  expect(await codesOf(t, batchId)).toEqual(before);
  const member = await seedUser(t, "member@example.com");
  await asUser(t, member).mutation(api.vouchers.redeem, { code: before[0]! });
});

// ---- The Seller's own view (ticket 05) -----------------------------------------

test("a Seller sees their own batches with a derived take-up count and the payment state", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const codes = await codesOf(t, batchId);

  let mine = await asUser(t, seller).query(api.vouchers.myBatches, {});
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    batchId,
    topicSlug: "hindi",
    courseTitle: "hindi",
    lang: "en",
    seats: 3,
    redeemed: 0,
    total: 500000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
    voided: false,
    // Not payable yet, and the Seller can see exactly why.
    paymentRef: null,
  });

  // The count is DERIVED from the codes, so it cannot drift: redeem one and it
  // moves without anything having incremented a counter.
  const member = await seedUser(t, "member@example.com");
  await asUser(t, member).mutation(api.vouchers.redeem, { code: codes[0]! });
  mine = await asUser(t, seller).query(api.vouchers.myBatches, {});
  expect(mine[0]).toMatchObject({ seats: 3, redeemed: 1 });

  await asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-993" });
  mine = await asUser(t, seller).query(api.vouchers.myBatches, {});
  expect(mine[0]).toMatchObject({ paymentRef: "FNB-993" });

  // Nothing anywhere in this view says WHO redeemed - it was never recorded, and
  // the member's account must not be inferable from it.
  expect(JSON.stringify(mine)).not.toContain("member@example.com");

  // And the code list is codes, with no per-code spent flag. The platform never
  // learns who redeemed, but the ORGANISATION knows which code it handed to which
  // of its people - so a spent/unspent list handed back to them reconstructs
  // exactly the who that the derived count exists to avoid. Take-up is a number.
  const codeList = await asUser(t, seller).query(api.vouchers.batchCodes, { batchId });
  expect(codeList).toEqual(expect.arrayContaining([expect.any(String)]));
  expect(codeList.every((c) => typeof c === "string")).toBe(true);
});

test("a Seller sees nothing of another Seller's batches, and cannot read their codes", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const other = await seedSeller(t, admin, "other@example.com", "urdu");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);

  expect(await asUser(t, other.seller).query(api.vouchers.myBatches, {})).toEqual([]);
  // The server-side negative that matters: codes are the one thing a Seller could
  // use against another Seller, so ownership is checked on the read itself.
  await expect(asUser(t, other.seller).query(api.vouchers.batchCodes, { batchId })).rejects.toThrow();
  await expect(t.query(api.vouchers.batchCodes, { batchId })).rejects.toThrow();
  // Even the sysadmin, who logs the money, has no path to a code.
  await expect(asUser(t, admin).query(api.vouchers.batchCodes, { batchId })).rejects.toThrow();

  const own = await asUser(t, seller).query(api.vouchers.batchCodes, { batchId });
  expect(own).toHaveLength(3);
  expect([...own].sort()).toEqual((await codesOf(t, batchId)).sort());
});

// ---- Voiding (ticket 07) --------------------------------------------------------

test("voiding stops the unused codes and leaves everything else exactly alone", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const other = await seedSeller(t, admin, "other@example.com", "urdu");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);
  const codes = await codesOf(t, batchId);

  // One seat is taken up before the deal goes wrong.
  const member = await seedUser(t, "member@example.com");
  await asUser(t, member).mutation(api.vouchers.redeem, { code: codes[0]! });
  await asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-993" });

  // Only the Seller who minted it may void it.
  await expect(asUser(t, other.seller).mutation(api.vouchers.voidBatch, { batchId })).rejects.toThrow();
  await expect(t.mutation(api.vouchers.voidBatch, { batchId })).rejects.toThrow();
  await expect(asUser(t, admin).mutation(api.vouchers.voidBatch, { batchId })).rejects.toThrow();

  await asUser(t, seller).mutation(api.vouchers.voidBatch, { batchId });
  expect((await asUser(t, seller).query(api.vouchers.myBatches, {}))[0]).toMatchObject({ voided: true });

  // An unredeemed code stops working.
  const latecomer = await seedUser(t, "latecomer@example.com");
  await expect(asUser(t, latecomer).mutation(api.vouchers.redeem, { code: codes[1]! })).rejects.toThrow(/voucher\/batch-voided/);

  // The surprising half, and the one to assert: the seat already granted is
  // untouched. It cannot even be found - the Entitlement carries no batch
  // provenance and the voucher records no user (ADR 0029).
  const held = await t.run((ctx) =>
    ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", member))
      .collect(),
  );
  expect(held).toHaveLength(1);

  // And the money is untouched: voiding is a statement about codes, never a
  // refund. The share logged before the void is still owed.
  expect((await ledgerRows(t))[0]).toMatchObject({ status: "owed", gross: 500000 });
  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed[0]).toMatchObject({ email: "author@example.com", totalOwed: 250000 });

  // Voiding twice is a no-op rather than an error.
  await asUser(t, seller).mutation(api.vouchers.voidBatch, { batchId });
  expect((await asUser(t, seller).query(api.vouchers.myBatches, {}))[0]).toMatchObject({ voided: true });
});

test("voiding an unpaid batch leaves its ledger row unpaid - void is not a refund", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, MINT);

  await asUser(t, seller).mutation(api.vouchers.voidBatch, { batchId });

  expect((await ledgerRows(t))[0]).toMatchObject({ status: "unpaid" });
  // Still on the sysadmin's queue, and MARKED: the codes stopped, the invoice did
  // not, so cash for the collapsed deal can still land and still has to be matched.
  const queue = await asUser(t, admin).query(api.vouchers.pendingBatches, {});
  expect(queue).toHaveLength(1);
  expect(queue[0]).toMatchObject({ voided: true });
});
