/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { offGateway, oncePerPayment, recordMoneyEvent, splitNet } from "./moneyEvent";

// The money event, the one writer every `ledger` row goes through (candidate 5 of
// the 2026-09-04 architecture review, ticket 29). Five rails used to hand-assemble
// their own row and call the split themselves. Two things are pinned here:
//
//   1. The arithmetic and the row shape, which used to be five copies of each.
//   2. The non-negative-integer cents check, which THREE rails ran, one ran a
//      narrower version of, and `eft.ts` did not run at all. The EFT case below
//      fails if the check is removed from the writer, which is the regression
//      test ticket 29 asks for.
//
// The split's own vectors were moved here from `payfast.test.ts` when `splitNet`
// left that module: a donation, a Voucher Batch and an Access Code all split a
// net, and none of them touches a gateway.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// ---- the split -----------------------------------------------------------------

test("splitNet halves a normal sale's net and always sums back to it", () => {
  expect(splitNet(8846, 5000)).toEqual({ payeeShare: 4423, platformShare: 4423 });
  // Odd cent: rounding never loses or mints money.
  const odd = splitNet(8847, 5000);
  expect(odd.payeeShare + odd.platformShare).toBe(8847);
  expect(odd.payeeShare).toBeGreaterThanOrEqual(0);
  expect(odd.platformShare).toBeGreaterThanOrEqual(0);
});

test("splitNet at the donation rate takes a tenth, not a half", () => {
  // The whole reason donations get their own constant: at PLATFORM_FEE_BPS
  // (5000) this same net would hand the platform 44750 instead of 8950.
  expect(splitNet(89500, 1000)).toEqual({ payeeShare: 80550, platformShare: 8950 });
});

test("the bps is the PLATFORM's share, which is its name and the take-rate convention", () => {
  // PLATFORM_FEE_BPS names the platform's cut (the old rail's 1500 meant a 15%
  // platform take). At 5000 the direction is invisible; at any other value it
  // must follow the name, and the PRD's literal formula had it backwards.
  expect(splitNet(10000, 2500)).toEqual({ payeeShare: 7500, platformShare: 2500 });
  expect(splitNet(10000, 0)).toEqual({ payeeShare: 10000, platformShare: 0 });
  expect(splitNet(10000, 10000)).toEqual({ payeeShare: 0, platformShare: 10000 });
});

test("splitNet on a fixed-fee-heavy cheap sale still yields non-negative shares summing to net", () => {
  // A R5 course: PayFast's fee leaves about 257c net. Nothing goes negative.
  const tiny = splitNet(257, 5000);
  expect(tiny.payeeShare + tiny.platformShare).toBe(257);
  expect(tiny.payeeShare).toBeGreaterThanOrEqual(0);
  expect(tiny.platformShare).toBeGreaterThanOrEqual(0);
  // Degenerate: a 1-cent net still splits without going negative.
  const one = splitNet(1, 5000);
  expect(one.payeeShare + one.platformShare).toBe(1);
  expect(one.payeeShare).toBeGreaterThanOrEqual(0);
});

test("offGateway says fee zero and net equals gross once, for the three rails with no gateway", () => {
  expect(offGateway(50000)).toEqual({ gross: 50000, fee: 0, net: 50000 });
});

// ---- the writer ----------------------------------------------------------------

test("recordMoneyEvent writes one row with the split applied and the shares summing to net", async () => {
  const t = convexTest(schema, modules);
  const payee = await seedUser(t, "payee@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: payee, slug: "s", title: "S" }));

  await t.run(async (ctx) => {
    await recordMoneyEvent(ctx, {
      kind: "sale",
      status: "owed",
      topicId,
      lang: "en",
      payeeId: payee,
      buyerEmail: "buyer@example.com",
      amounts: { gross: 50000, fee: 1154, net: 48846 },
      platformBps: 5000,
      pfPaymentId: "pf-1",
    });
  });

  const rows = await t.run((ctx) => ctx.db.query("ledger").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "sale",
    status: "owed",
    topicId,
    lang: "en",
    sellerId: payee,
    buyerEmail: "buyer@example.com",
    gross: 50000,
    fee: 1154,
    net: 48846,
    sellerShare: 24423,
    platformShare: 24423,
    pfPaymentId: "pf-1",
  });
  expect(rows[0]!.eftRef).toBeUndefined();
});

test("recordMoneyEvent refuses amounts that are not non-negative integer cents", async () => {
  const t = convexTest(schema, modules);
  const payee = await seedUser(t, "payee@example.com");
  const bad = [
    { gross: 100.5, fee: 0, net: 100.5 },
    { gross: -1, fee: 0, net: -1 },
    { gross: 100, fee: -1, net: 101 },
    { gross: Number.NaN, fee: 0, net: 0 },
  ];
  for (const amounts of bad) {
    await expect(
      t.run((ctx) =>
        recordMoneyEvent(ctx, {
          kind: "donation",
          status: "owed",
          payeeId: payee,
          buyerEmail: "donor@example.com",
          amounts,
          platformBps: 1000,
        }),
      ),
    ).rejects.toThrow(/non-negative integer cents/);
  }
  // Nothing was banked on the way to any of those throws.
  expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toHaveLength(0);
});

test("oncePerPayment records the payment and reports the second delivery as seen", async () => {
  const t = convexTest(schema, modules);
  const first = await t.run((ctx) => oncePerPayment(ctx, "pf-42"));
  const second = await t.run((ctx) => oncePerPayment(ctx, "pf-42"));
  expect(first).toBe(false);
  expect(second).toBe(true);
  // One row, not two: the second call must not re-record it either.
  expect(await t.run((ctx) => ctx.db.query("payfastEvents").collect())).toHaveLength(1);
});

// ---- the EFT rail's regained cents check ---------------------------------------

test("the EFT rail refuses to bank an intent whose amount is not integer cents", async () => {
  // This is ticket 29's regression test. `eft.ts` inserted its ledger row by hand
  // with no cents validation of any kind, so a fractional intent amount would
  // have written a fractional ledger row and a fractional payout share. It now
  // goes through `recordMoneyEvent`, so the check applies. Delete the loop in
  // `recordMoneyEvent` and this test fails.
  //
  // The intent is seeded directly because `startEftPurchase` derives its amount
  // from a listing, and `setEditionPrice` already refuses a non-integer price.
  // The hole was never reachable from the UI; it was reachable from any future
  // caller, and from a listing written by a script.
  const t = convexTest(schema, modules);
  const admin = await seedUser(t, "admin@example.com");
  await t.run((ctx) => ctx.db.insert("whitelist", { email: "admin@example.com", isAdmin: true }));
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: seller, slug: "tswana", title: "Tswana", status: "completed" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("eftIntents", { ref: "TSW-ABCD", userId: buyer, topicId, lang: "en", amount: 4999.5, status: "pending" }),
  );

  await expect(
    asUser(t, admin).mutation(api.eft.confirmEftPayment, { ref: "TSW-ABCD" }),
  ).rejects.toThrow(/non-negative integer cents/);

  // The whole transaction rolled back: no ledger row, no Entitlement, and the
  // intent is still pending so the operator can see it needs attention.
  expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toHaveLength(0);
  const [intent] = await t.run((ctx) => ctx.db.query("eftIntents").collect());
  expect(intent!.status).toBe("pending");
});

// ---- the boundary ---------------------------------------------------------------

test("no rail reaches the payout arithmetic directly", async () => {
  // The point of ticket 29: `splitNet` is reachable from this module and its test,
  // and from nowhere else. A rail that imports it again has reopened the hole,
  // and the five hand-written copies start growing back.
  const files = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const importers = Object.entries(files)
    .filter(([path]) => path !== "./moneyEvent.ts" && path !== "./moneyEvent.test.ts")
    .filter(([, src]) => /import\s*\{[^}]*\bsplitNet\b[^}]*\}/.test(src) || /\bsplitNet\s*\(/.test(src))
    .map(([path]) => path);
  expect(importers).toEqual([]);
});
