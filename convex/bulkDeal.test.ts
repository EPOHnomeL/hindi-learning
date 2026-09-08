/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { assertOrganisation, freshDealCode, logDealPayment, unsettledDeals } from "./bulkDeal";
import { mintCode } from "./voucherCode";
import { mintAccessCodeString } from "./accessCodeFormat";

// The shared bulk-deal core (ticket 30). `accessCodes.ts` said in its own header
// that it was a deliberate mirror of `vouchers.ts` and had become line for line
// across seven mechanisms, so every bulk-sales change was two edits and every
// bulk-sales audit two files.
//
// The behavioural coverage of both rails already exists in `vouchers.test.ts` and
// `accessCodes.test.ts` and did not change, which is the assertion that this was
// a move. What is here is what those two could not say: that the mechanisms are
// now ONE implementation, and that the three genuine differences survived.

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

test("the organisation is two trimmed strings, and neither may be blank", () => {
  expect(assertOrganisation("  The Party  ", " billing@party.example ")).toEqual({
    org: "The Party",
    contact: "billing@party.example",
  });
  // A blank contact would put an anonymous money event on the operator's queue,
  // because the contact IS the Ledger row's buyerEmail.
  for (const [org, contact] of [
    ["", "billing@x.test"],
    ["Org", ""],
    ["   ", "billing@x.test"],
    ["Org", "   "],
  ]) {
    expect(() => assertOrganisation(org!, contact!)).toThrow(/name and billing contact are both required/);
  }
});

test("a fresh code is unique per rail, and each rail keeps its own SHAPE", async () => {
  const t = convexTest(schema, modules);
  const seller = await seedUser(t, "seller@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "s", title: "S" }));
  const batchId = await t.run(async (ctx) => {
    const ledgerId = await ctx.db.insert("ledger", {
      topicId,
      lang: "en",
      sellerId: seller,
      buyerEmail: "b@x.test",
      gross: 100,
      fee: 0,
      net: 100,
      sellerShare: 50,
      platformShare: 50,
      kind: "batch",
      status: "unpaid",
    });
    return await ctx.db.insert("voucherBatches", {
      topicId,
      lang: "en",
      sellerId: seller,
      seats: 1,
      total: 100,
      orgName: "Org",
      orgContact: "b@x.test",
      ledgerId,
      voided: false,
    });
  });
  const voucher = await t.run((ctx) => freshDealCode(ctx, "vouchers", mintCode));
  const access = await t.run((ctx) => freshDealCode(ctx, "accessCodes", mintAccessCodeString));

  // The shapes are deliberately different and NOT shared: both rails can be live
  // on one Edition at once, and a GRP code must not be mistakable for a MYC one.
  expect(voucher).toMatch(/^MYC(-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}){2}$/);
  expect(access).toMatch(/^GRP(-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}){3}$/);

  // And it checks the rail it was asked about: a code already held is retried past.
  await t.run((ctx) => ctx.db.insert("vouchers", { batchId, code: voucher }));
  const second = await t.run((ctx) => freshDealCode(ctx, "vouchers", mintCode));
  expect(second).not.toBe(voucher);
});

test("logging a payment is admin-only, refuses a blank reference, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedUser(t, "admin@example.com");
  await t.run((ctx) => ctx.db.insert("whitelist", { email: "admin@example.com", isAdmin: true }));
  const seller = await seedUser(t, "seller@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "s", title: "S" }));
  const ledgerId = await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId,
      lang: "en",
      sellerId: seller,
      buyerEmail: "b@x.test",
      gross: 100,
      fee: 0,
      net: 100,
      sellerShare: 50,
      platformShare: 50,
      kind: "batch",
      status: "unpaid",
    }),
  );
  const codeId = await t.run((ctx) =>
    ctx.db.insert("accessCodes", {
      topicId,
      lang: "en",
      sellerId: seller,
      code: "GRP-AAA-BBB-CCC",
      capacity: 3,
      pricePerSeat: 100,
      orgName: "Org",
      orgContact: "b@x.test",
      ledgerId,
      stoppedAt: Date.now(),
    }),
  );

  // Not an admin: refused.
  await expect(
    t.withIdentity({ subject: `${seller}|session` }).run((ctx) =>
      logDealPayment(ctx, { id: codeId, ledgerId }, "ABC123"),
    ),
  ).rejects.toThrow(/forbidden/);

  const asAdmin = t.withIdentity({ subject: `${admin}|session` });
  // A blank reference is refused: the whole point is pointing at a statement line.
  await expect(asAdmin.run((ctx) => logDealPayment(ctx, { id: codeId, ledgerId }, "   "))).rejects.toThrow(
    /bank reference or transaction id is required/,
  );

  await asAdmin.run((ctx) => logDealPayment(ctx, { id: codeId, ledgerId }, "  ABC123  "));
  expect((await t.run((ctx) => ctx.db.get(codeId)))!.paymentRef).toBe("ABC123");
  expect((await t.run((ctx) => ctx.db.get(ledgerId)))!.status).toBe("owed");

  // A second click must not overwrite the reference that reconciles the line.
  await asAdmin.run((ctx) =>
    logDealPayment(ctx, { id: codeId, paymentRef: "ABC123", ledgerId }, "SOMETHING-ELSE"),
  );
  expect((await t.run((ctx) => ctx.db.get(codeId)))!.paymentRef).toBe("ABC123");
});

test("a paid Ledger row is never re-owed by logging a reference again", async () => {
  // The posture `markPaid` takes from the other end of the lifecycle.
  const t = convexTest(schema, modules);
  const admin = await seedUser(t, "admin@example.com");
  await t.run((ctx) => ctx.db.insert("whitelist", { email: "admin@example.com", isAdmin: true }));
  const seller = await seedUser(t, "seller@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "s", title: "S" }));
  const ledgerId = await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId,
      lang: "en",
      sellerId: seller,
      buyerEmail: "b@x.test",
      gross: 100,
      fee: 0,
      net: 100,
      sellerShare: 50,
      platformShare: 50,
      kind: "batch",
      status: "paid",
    }),
  );
  const codeId = await t.run((ctx) =>
    ctx.db.insert("accessCodes", {
      topicId,
      lang: "en",
      sellerId: seller,
      code: "GRP-AAA-BBB-CCD",
      capacity: 3,
      pricePerSeat: 100,
      orgName: "Org",
      orgContact: "b@x.test",
      ledgerId,
      stoppedAt: Date.now(),
    }),
  );
  await t
    .withIdentity({ subject: `${admin}|session` })
    .run((ctx) => logDealPayment(ctx, { id: codeId, ledgerId }, "REF"));
  expect((await t.run((ctx) => ctx.db.get(ledgerId)))!.status).toBe("paid");
});

test("a zero-seat code has no Ledger row, and logging its payment does not fall over", async () => {
  // The one asymmetry in `logDealPayment`: a Batch always has a row, a code
  // stopped with zero seats settles to nothing and has none.
  const t = convexTest(schema, modules);
  const admin = await seedUser(t, "admin@example.com");
  await t.run((ctx) => ctx.db.insert("whitelist", { email: "admin@example.com", isAdmin: true }));
  const seller = await seedUser(t, "seller@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "s", title: "S" }));
  const codeId = await t.run((ctx) =>
    ctx.db.insert("accessCodes", {
      topicId,
      lang: "en",
      sellerId: seller,
      code: "GRP-AAA-BBB-CCE",
      capacity: 3,
      pricePerSeat: 100,
      orgName: "Org",
      orgContact: "b@x.test",
      stoppedAt: Date.now(),
    }),
  );
  await t.withIdentity({ subject: `${admin}|session` }).run((ctx) => logDealPayment(ctx, { id: codeId }, "REF"));
  expect((await t.run((ctx) => ctx.db.get(codeId)))!.paymentRef).toBe("REF");
});

test("the settlement queue is an absent paymentRef, on both rails", async () => {
  // Indexed rather than filtered, so a settled deal is invisible with no
  // predicate a later edit could forget to apply.
  const t = convexTest(schema, modules);
  const seller = await seedUser(t, "seller@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "s", title: "S" }));
  const base = {
    topicId,
    lang: "en",
    sellerId: seller,
    capacity: 3,
    pricePerSeat: 100,
    orgName: "Org",
    orgContact: "b@x.test",
  };
  await t.run(async (ctx) => {
    await ctx.db.insert("accessCodes", { ...base, code: "GRP-AAA-AAA-AAA" });
    await ctx.db.insert("accessCodes", { ...base, code: "GRP-BBB-BBB-BBB", paymentRef: "SETTLED" });
  });

  const unsettled = await t.run((ctx) => unsettledDeals(ctx, "accessCodes"));
  expect(unsettled.map((d) => d.code)).toEqual(["GRP-AAA-AAA-AAA"]);
  // And the same call answers for the other rail's table.
  expect(await t.run((ctx) => unsettledDeals(ctx, "voucherBatches"))).toEqual([]);
});

test("nothing outside the deal module re-implements a mechanism it owns", async () => {
  // The mirror is what ticket 30 exists to end. A rail that starts writing its own
  // trim-and-refuse, its own retry loop or its own paymentRef index read has
  // started the second copy again.
  const files = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;
  const src = Object.entries(files).filter(([p]) => !p.endsWith(".test.ts") && p !== "./bulkDeal.ts");
  const patterns: [string, RegExp][] = [
    ["the org trim-and-refuse", /name and billing contact are both required/],
    ["the unique-code retry loop", /could not mint a unique code/],
    ["the settlement-queue index read", /withIndex\("by_payment_ref"/],
  ];
  for (const [what, re] of patterns) {
    expect(
      src.filter(([, s]) => re.test(s)).map(([p]) => p),
      what,
    ).toEqual([]);
  }
});
