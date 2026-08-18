/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The Ledger admin seam (.scratch/payfast-payments, ticket 06): the operator
// sees what they owe each author (sum of `owed` rows per Seller, with the bank
// details to EFT to and the contributing sales) and records manual payouts —
// mark-paid flips rows `owed` → `paid` with a reference, so a row is never
// double-counted. Both are Admin-only.

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
const PAYOUT = { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };

// A Seller with a completed course and `owed` Ledger rows — the state the
// verified ITN (fulfillPurchase) leaves behind.
async function seedSales(t: ReturnType<typeof convexTest>) {
  const author = await seedUser(t, "author@example.com");
  await t.run((ctx) => ctx.db.insert("sellers", { userId: author, payout: PAYOUT }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  const row = (buyer: string, pf: string, sellerShare: number) => ({
    topicId,
    lang: "en",
    sellerId: author,
    buyerEmail: buyer,
    gross: 120000,
    fee: 2760,
    net: 117240,
    sellerShare,
    platformShare: 117240 - sellerShare,
    pfPaymentId: pf,
    status: "owed" as const,
  });
  const sale1 = await t.run((ctx) => ctx.db.insert("ledger", row("b1@example.com", "pf_1", 58620)));
  const sale2 = await t.run((ctx) => ctx.db.insert("ledger", row("b2@example.com", "pf_2", 58620)));
  return { author, topicId, sale1, sale2 };
}

test("owedPayouts is Admin-only and sums only owed rows per author, with bank details + sales", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const { author, sale1, sale2 } = await seedSales(t);

  // A non-admin (the author included) cannot read the payouts view.
  await expect(asUser(t, author).query(api.ledger.owedPayouts, {})).rejects.toThrow();

  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed).toHaveLength(1);
  expect(owed[0]).toMatchObject({
    email: "author@example.com",
    payout: PAYOUT,
    totalOwed: 117240, // 58620 + 58620 — only `owed` rows
  });
  expect(owed[0]!.sales.map((s) => s.id).sort()).toEqual([sale1, sale2].sort());
  expect(owed[0]!.sales[0]).toMatchObject({ lang: "en", sellerShare: 58620, buyerEmail: expect.any(String) });
});

test("markPaid is Admin-only, flips owed→paid with a reference, and never double-counts", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const { author, sale1, sale2 } = await seedSales(t);

  // A non-admin cannot mark a payout.
  await expect(
    asUser(t, author).mutation(api.ledger.markPaid, { ids: [sale1], reference: "EFT-1" }),
  ).rejects.toThrow();
  // A blank reference is refused (the whole point is reconciling the EFT).
  await expect(
    asUser(t, admin).mutation(api.ledger.markPaid, { ids: [sale1], reference: "   " }),
  ).rejects.toThrow();

  // Pay out one sale → it's recorded and drops out of the owed total.
  await asUser(t, admin).mutation(api.ledger.markPaid, { ids: [sale1], reference: "EFT-2026-07-1" });
  const paid = await t.run((ctx) => ctx.db.get(sale1));
  expect(paid).toMatchObject({ status: "paid", payoutRef: "EFT-2026-07-1" });

  let owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed[0]).toMatchObject({ totalOwed: 58620 });
  expect(owed[0]!.sales.map((s) => s.id)).toEqual([sale2]);

  // Re-marking an already-paid row is a no-op that keeps the ORIGINAL reference.
  await asUser(t, admin).mutation(api.ledger.markPaid, { ids: [sale1, sale2], reference: "EFT-2026-07-2" });
  expect(await t.run((ctx) => ctx.db.get(sale1))).toMatchObject({ payoutRef: "EFT-2026-07-1" });
  expect(await t.run((ctx) => ctx.db.get(sale2))).toMatchObject({ status: "paid", payoutRef: "EFT-2026-07-2" });

  // Everything paid → the author no longer appears in the owed view.
  owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed).toEqual([]);
});

// A Voucher Batch's money event (vouchers ticket 01, ADR 0029): a batch is sold
// BEFORE the cash arrives and its codes work immediately, so its Ledger row exists
// from creation at `unpaid` and must be invisible to payouts until the sysadmin logs
// the transfer. The guard is the `by_status` index this query already reads: `unpaid`
// simply isn't `owed`, so no filter has to remember to exclude it.
async function seedBatchRow(
  t: ReturnType<typeof convexTest>,
  status: "unpaid" | "owed",
): Promise<{ author: Id<"users">; row: Id<"ledger"> }> {
  const author = await seedUser(t, "author@example.com");
  await t.run((ctx) => ctx.db.insert("sellers", { userId: author, payout: PAYOUT }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  const row = await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId,
      lang: "en",
      sellerId: author,
      // The BUYING ORGANISATION's billing contact, not a member's - a batch is one
      // commercial event with one buyer, however many seats it carries.
      buyerEmail: "billing@party.example.org",
      gross: 500000,
      fee: 0, // no gateway took a cut
      net: 500000,
      sellerShare: 250000,
      platformShare: 250000,
      kind: "batch" as const,
      status,
    }),
  );
  return { author, row };
}

test("an unpaid batch row is invisible to owedPayouts; logging the cash makes it payable", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const { row } = await seedBatchRow(t, "unpaid");

  // Nobody is owed anything yet - the seats are live but the money hasn't landed.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);

  // The sysadmin logs the transfer (vouchers ticket 04 does this through a mutation;
  // here the flip stands in for it, since no writer exists yet).
  await t.run((ctx) => ctx.db.patch(row, { status: "owed" }));

  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed).toHaveLength(1);
  expect(owed[0]).toMatchObject({ email: "author@example.com", payout: PAYOUT, totalOwed: 250000 });
  expect(owed[0]!.sales[0]).toMatchObject({
    id: row,
    kind: "batch",
    lang: "en",
    buyerEmail: "billing@party.example.org",
    sellerShare: 250000,
  });
});

test("markPaid never pays out an unpaid batch row", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const { row } = await seedBatchRow(t, "unpaid");

  // Even asked directly, an `unpaid` row cannot be marked paid: the money hasn't
  // arrived, so there is nothing to pay out and no reference to record.
  await asUser(t, admin).mutation(api.ledger.markPaid, { ids: [row], reference: "EFT-oops" });
  expect(await t.run((ctx) => ctx.db.get(row))).toMatchObject({ status: "unpaid" });
  expect(await t.run((ctx) => ctx.db.get(row))).not.toHaveProperty("payoutRef");
});

// The same guard, now driven end to end by the rail's own writers rather than a
// hand-seeded row (vouchers ticket 04). The batch's Ledger row is written by
// `vouchers.mintBatch` and moved by `vouchers.logBatchPayment`, so this asserts
// the actual lifecycle the sysadmin walks: mint, nothing owed, log the transfer,
// the Seller's 50% owed under their own name.
test("a logged batch payment makes the minting Seller's share payable", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");

  const seller = await seedUser(t, "author@example.com");
  await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: seller, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: "author@example.com" });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  await asUser(t, seller).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: true,
  });
  const batchId = await asUser(t, seller).mutation(api.vouchers.mintBatch, {
    topicSlug: "hindi",
    lang: "en",
    seats: 100,
    total: 500000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
  });

  // The seats are live, and nobody is owed anything: the money has not arrived.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);

  await asUser(t, admin).mutation(api.vouchers.logBatchPayment, { batchId, reference: "FNB-993" });

  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed).toHaveLength(1);
  expect(owed[0]).toMatchObject({ email: "author@example.com", payout: PAYOUT, totalOwed: 250000 });
  // One row for the whole batch, however many seats it carries.
  expect(owed[0]!.sales).toHaveLength(1);
  expect(owed[0]!.sales[0]).toMatchObject({ kind: "batch", lang: "en", buyerEmail: "billing@party.example.org" });
});
