/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The manual EFT rail (ywampotch-launch ticket 02): the **operator's collection**
// bank account. Two seams:
//   1. `operatorBank` / `saveOperatorBank` — the sys-admin editor. Sys admin only:
//      a tenant admin must not be able to change where the platform's money is
//      collected, so the authorisation negative is asserted server-side, not by
//      the absence of a button.
//   2. `eftDetails` — the buyer-facing read on the paygate. Returns the details
//      only while the rail is `enabled`, and only to a signed-in caller.
// Fixtures seed only what production writes: `users` rows as auth writes them and
// `whitelist` rows as `whitelist.seedEmail`/`scopeToTenant` write them (a sys
// admin is `isAdmin` with no slug; a tenant admin is `isAdmin` + a slug). The
// operatorBank row is never hand-seeded — every test writes it through the
// mutation, which is the only thing that ever creates it.

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
async function seedTenantAdmin(t: ReturnType<typeof convexTest>, email: string, tenantSlug: string) {
  const id = await seedUser(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true, tenantSlug }));
  return id;
}

const BANK = {
  accountHolder: "YWAM Potch",
  bank: "FNB",
  accountNumber: "62000000001",
  branchCode: "250655",
};

// Pricing an Edition requires a provisioned PayFast rail (market.setEditionPrice
// refuses without it), and pricing is what makes an Edition payable at all — so
// the EFT tests reach the paid state through the same production path, with the
// sandbox trio in place. The EFT rail itself never touches PayFast.
beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";
});

const PAYOUT = { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };

// A priced Edition, reached the way production reaches it: the admin grants
// can-sell, the seller saves payout details, then the OWNER prices their own
// completed course. Only the `topics`/`lessons` rows are hand-inserted (the shape
// `content.seedTopic` and the Routine's publish write), following the precedent in
// sellers.test.ts.
async function seedPricedEdition(
  t: ReturnType<typeof convexTest>,
  admin: Id<"users">,
  seller: Id<"users">,
  sellerEmail: string,
  slug: string,
  langs: string[] = ["en"],
  amount = 50000,
) {
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: seller, slug, title: slug, status: "completed" }),
  );
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "Lesson 1", htmlStorageId });
  });
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email: sellerEmail });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  for (const lang of langs) {
    // A non-English Edition has to be HELD before it can be priced, and for the
    // owner "held" means a `ready` translation job (lib.ts heldLangs) — the row
    // `reportTranslation` leaves behind at the end of a successful run.
    if (lang !== "en") {
      await t.run((ctx) =>
        ctx.db.insert("translationJobs", { topicId, lang, status: "ready", total: 1, done: 1, failed: 0 }),
      );
    }
    await asUser(t, seller).mutation(api.market.setEditionPrice, { topicSlug: slug, lang, amount, currency: "zar" });
  }
  return topicId;
}

async function enableRail(t: ReturnType<typeof convexTest>, sys: Id<"users">) {
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
}

async function intentRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("eftIntents").take(100));
}
async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(100));
}
async function entitlementRows(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
      .collect(),
  );
}

// ---- Seam — the sys-admin editor --------------------------------------------

test("only a sys admin can write the operator's collection account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const tenantAdmin = await seedTenantAdmin(t, "potch@example.com", "ywampotch");
  const member = await seedUser(t, "learner@example.com");

  // A tenant admin is the important negative: they administer a subdomain, but
  // not where the platform's money lands.
  await expect(
    asUser(t, tenantAdmin).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true }),
  ).rejects.toThrow();
  await expect(
    asUser(t, member).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true }),
  ).rejects.toThrow();
  await expect(t.mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true })).rejects.toThrow();

  // Nothing was written by any of the refusals.
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toBeNull();

  // The sys admin can, and reads it back.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toEqual({ ...BANK, enabled: true });
});

test("only a sys admin can read the editor's view of the account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const tenantAdmin = await seedTenantAdmin(t, "potch@example.com", "ywampotch");
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });

  await expect(asUser(t, tenantAdmin).query(api.eft.operatorBank, {})).rejects.toThrow();
  await expect(t.query(api.eft.operatorBank, {})).rejects.toThrow();
});

test("saving edits the one row in place — never a second account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");

  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, {
    ...BANK,
    accountNumber: "62999999999",
    enabled: false,
  });

  const rows = await t.run((ctx) => ctx.db.query("operatorBank").collect());
  expect(rows).toHaveLength(1);
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toEqual({
    ...BANK,
    accountNumber: "62999999999",
    enabled: false,
  });
});

test("saveOperatorBank rejects blank or non-numeric fields", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");

  for (const bad of [
    { ...BANK, accountHolder: "   " },
    { ...BANK, bank: "" },
    { ...BANK, accountNumber: "not-digits" },
    { ...BANK, branchCode: "12ab" },
  ]) {
    await expect(
      asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...bad, enabled: true }),
    ).rejects.toThrow();
  }
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toBeNull();
});

// ---- Seam — the buyer-facing read -------------------------------------------

test("the buyer read returns the details only while the rail is enabled", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const buyer = await seedUser(t, "buyer@example.com");

  // Unconfigured rail → nothing to show (no row at all).
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toBeNull();

  // Configured but switched off → still nothing: the toggle is the rail's off switch.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: false });
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toBeNull();

  // Enabled → a signed-in buyer sees the account to pay into.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toEqual(BANK);
});

test("the buyer read is signed-in only — an anonymous visitor gets nothing", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });

  // Checkout is auth-first (.scratch/auth-first-checkout), so the paygate always
  // has an account behind it — an anonymous read has no reason to see the account.
  expect(await t.query(api.eft.eftDetails, {})).toBeNull();
});

// ---- Seam — the buyer's "Pay by EFT" click (ticket 03) -----------------------

test("a disabled rail refuses the intent server-side, not just in the component", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");

  // Never configured → refused.
  await expect(
    asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" }),
  ).rejects.toThrow();

  // Configured but switched off → still refused. The toggle is the rail, not a UI hint.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: false });
  await expect(
    asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" }),
  ).rejects.toThrow();
  expect(await intentRows(t)).toHaveLength(0);
});

test("Pay by EFT mints a bank-statement-safe reference and grants nothing", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);

  const { ref, bank, amount } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, {
    topicSlug: "tswana",
    lang: "en",
  });

  // Short, upper-case, no lookalike characters — a human types this into a banking
  // app and a mistyped reference is an unmatchable payment.
  expect(ref).toMatch(/^TSW-[A-Z0-9]{4}$/); // topic-derived prefix + random suffix
  // The RANDOM half avoids characters that collide when handwritten or read down
  // a phone line (I/1, O/0, S/5, Z/2). The prefix is taken from the course slug, so
  // it stays legible rather than being filtered into something unrecognisable.
  expect(ref.split("-")[1]).not.toMatch(/[IOLSZ0125]/);
  expect(bank).toEqual(BANK);
  expect(amount).toBe(50000);

  // The reference the buyer was shown IS the reference on the row, with the price
  // frozen at click, pending, and attributed to the buyer's account.
  const rows = await intentRows(t);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ ref, userId: buyer, topicId, lang: "en", amount: 50000, status: "pending" });

  // An intent is not a grant: no Entitlement, and the reader is still locked.
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents).toHaveLength(0);
});

test("clicking twice on the same Edition reuses the one reference", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);

  const first = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });
  const second = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  // Two competing references for one buyer and one Edition is how a real payment
  // gets matched to the wrong row (or to none).
  expect(second.ref).toBe(first.ref);
  expect(await intentRows(t)).toHaveLength(1);
});

test("references are unique per buyer and per Edition", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const other = await seedUser(t, "other@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana", ["en", "af"]);
  await enableRail(t, sys);

  const refs = [
    (await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" })).ref,
    (await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "af" })).ref,
    (await asUser(t, other).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" })).ref,
  ];
  expect(new Set(refs).size).toBe(3);
  expect(await intentRows(t)).toHaveLength(3);
});

test("Pay by EFT needs an account and a priced Edition", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);

  // Auth-first (ADR 0021): the intent is keyed to a user, and access has to
  // attribute to one — an anonymous EFT reference could never be granted.
  await expect(t.mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" })).rejects.toThrow();

  // A free Edition has nothing to transfer, and an unknown course nothing to buy.
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: seller, slug: "free", title: "free", status: "completed" }));
  await expect(
    asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "free", lang: "en" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "ghost", lang: "en" }),
  ).rejects.toThrow();
  expect(await intentRows(t)).toHaveLength(0);
});

// ---- Seam — the returning buyer's pending state ------------------------------

test("a buyer who leaves and returns sees their pending reference, not the bare paygate", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const other = await seedUser(t, "other@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana", ["en", "af"]);
  await enableRail(t, sys);

  // Nothing pending yet.
  expect(await asUser(t, buyer).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toBeNull();

  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  // The buyer's own pending intent, with the bank details to finish the transfer.
  expect(await asUser(t, buyer).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toEqual({
    ref,
    amount: 50000,
    bank: BANK,
  });

  // Scoped to the Edition and to the buyer: another language and another account
  // are unaffected (buying `en` says nothing about `af`).
  expect(await asUser(t, buyer).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "af" })).toBeNull();
  expect(await asUser(t, other).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toBeNull();
  expect(await t.query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toBeNull();
});

test("a resolved intent stops showing as pending", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  // The confirm/dismiss actions land in ticket 04; this asserts only what the
  // buyer-facing read promises — the pending banner is tied to `status`, so the
  // reactive query clears itself the moment the operator resolves the row.
  const [row] = await intentRows(t);
  await t.run((ctx) => ctx.db.patch(row!._id, { status: "confirmed" }));
  expect(await asUser(t, buyer).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toBeNull();

  await t.run((ctx) => ctx.db.patch(row!._id, { status: "dismissed" }));
  expect(await asUser(t, buyer).query(api.eft.myEftIntent, { topicSlug: "tswana", lang: "en" })).toBeNull();

  // A dismissed intent leaves the buyer free to start a fresh one (a new reference).
  const again = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });
  expect(again.ref).not.toBe(row!.ref);
  expect(await intentRows(t)).toHaveLength(2);
});

// ---- Seam — the operator's confirm queue (ticket 04) -------------------------

// Idempotency comes first because it is the money-losing failure: a double
// confirmation must never mean a double grant or a double Ledger row.

test("confirming the same reference twice grants and owes exactly once", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });
  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });

  expect(await entitlementRows(t, topicId, buyer)).toHaveLength(1);
  expect(await ledgerRows(t)).toHaveLength(1);
  expect((await intentRows(t))[0]!.status).toBe("confirmed");
});

test("confirming mints the Entitlement and the Ledger row a manual sale needs", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });

  // The Entitlement carries the EFT reference and no PayFast id — that is the
  // provenance that says which rail sold the seat.
  const [ent] = await entitlementRows(t, topicId, buyer);
  expect(ent).toMatchObject({ lang: "en", eftRef: ref });
  expect(ent!.pfPaymentId).toBeUndefined();

  // No gateway took a cut, so fee is 0 and net == gross; the 50/50 split still
  // comes from `splitNet`, so the payout arithmetic is the card rail's.
  const [row] = await ledgerRows(t);
  expect(row).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    buyerEmail: "buyer@example.com",
    gross: 50000,
    fee: 0,
    net: 50000,
    eftRef: ref,
    status: "owed",
  });
  expect(row!.pfPaymentId).toBeUndefined();
  expect(row!.sellerShare + row!.platformShare).toBe(row!.net);
});

test("a confirmed EFT sale shows up as owed to the seller in Payouts", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });
  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });

  // A sale the operator can't see is a sale the seller never gets paid for — this
  // is exactly why confirm writes a Ledger row instead of a bare grant.
  const owed = await asUser(t, sys).query(api.ledger.owedPayouts, {});
  expect(owed).toHaveLength(1);
  expect(owed[0]!.email).toBe("seller@example.com");
  expect(owed[0]!.totalOwed).toBe(25000);
});

test("a buyer who already holds the Edition gets no second Entitlement", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  // They bought it another way meanwhile. `market.grantEntitlement` is the real
  // seam that mints an Entitlement outside the ITN, so use it rather than a
  // hand-inserted row.
  await asUser(t, sys).mutation(api.market.grantEntitlement, {
    email: "buyer@example.com",
    topicSlug: "tswana",
    lang: "en",
  });
  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });

  // Per the operator's 2026-07-29 decision this collision is sorted out by hand:
  // whatever the (buyer, Topic, language) guard naturally does is correct. No
  // double grant — but the money that did arrive is still recorded.
  expect(await entitlementRows(t, topicId, buyer)).toHaveLength(1);
  expect(await ledgerRows(t)).toHaveLength(1);
});

test("dismiss clears an intent that never got paid, and grants nothing", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  await asUser(t, sys).mutation(api.eft.dismissEftIntent, { ref });

  expect(await asUser(t, sys).query(api.eft.pendingEftIntents, {})).toEqual([]);
  expect(await entitlementRows(t, topicId, buyer)).toHaveLength(0);
  expect(await ledgerRows(t)).toHaveLength(0);

  // A dismissed reference can't be quietly confirmed afterwards — the money would
  // have to arrive against a fresh one.
  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });
  expect(await entitlementRows(t, topicId, buyer)).toHaveLength(0);
  expect(await ledgerRows(t)).toHaveLength(0);
});

test("the queue lists what the operator needs to match a transfer", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  expect(await asUser(t, sys).query(api.eft.pendingEftIntents, {})).toEqual([
    { ref, email: "buyer@example.com", courseTitle: "tswana", lang: "en", amount: 50000 },
  ]);

  // Resolved intents leave the queue — it is a to-do list, not a log. A queue that
  // silts up stops being read, and that is how a real payment gets missed.
  await asUser(t, sys).mutation(api.eft.confirmEftPayment, { ref });
  expect(await asUser(t, sys).query(api.eft.pendingEftIntents, {})).toEqual([]);
});

test("a tenant admin can neither read the queue nor confirm or dismiss", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const tenantAdmin = await seedTenantAdmin(t, "potch@example.com", "ywampotch");
  const seller = await seedUser(t, "seller@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedPricedEdition(t, sys, seller, "seller@example.com", "tswana");
  await enableRail(t, sys);
  const { ref } = await asUser(t, buyer).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });

  // Confirming mints access AND money. Tenant admins administer a subdomain.
  await expect(asUser(t, tenantAdmin).query(api.eft.pendingEftIntents, {})).rejects.toThrow();
  await expect(asUser(t, tenantAdmin).mutation(api.eft.confirmEftPayment, { ref })).rejects.toThrow();
  await expect(asUser(t, tenantAdmin).mutation(api.eft.dismissEftIntent, { ref })).rejects.toThrow();
  await expect(asUser(t, buyer).mutation(api.eft.confirmEftPayment, { ref })).rejects.toThrow();
  await expect(t.mutation(api.eft.confirmEftPayment, { ref })).rejects.toThrow();

  expect(await entitlementRows(t, topicId, buyer)).toHaveLength(0);
  expect(await ledgerRows(t)).toHaveLength(0);
  expect((await intentRows(t))[0]!.status).toBe("pending");
});
