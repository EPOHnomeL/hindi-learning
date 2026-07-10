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
  const row = (buyer: string, pf: string, authorShare: number) => ({
    topicId,
    lang: "en",
    sellerId: author,
    buyerEmail: buyer,
    gross: 120000,
    fee: 2760,
    net: 117240,
    authorShare,
    platformShare: 117240 - authorShare,
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
  expect(owed[0]!.sales[0]).toMatchObject({ lang: "en", authorShare: 58620, buyerEmail: expect.any(String) });
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
