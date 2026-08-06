/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { chargeCents, regionForCountry } from "./regions";
import { EUR_ZAR_RATE, USD_ZAR_RATE } from "./rates";
import type { Id } from "./_generated/dataModel";

// **Regional pricing** (ywampotch-launch ticket 11 → 20). $10 for US buyers,
// €10 for the EU/Western Europe, R100 everywhere else — and the $10 is roughly
// DOUBLE the base price, not a translation of it, so this is real price
// discrimination and the number that reaches the intent must be the number the
// buyer was shown.
//
// The three things that must hold and would be expensive to get wrong:
//   1. the SERVER derives the charge from the `country` argument — a client
//      never sends an amount, or this stops being pricing and becomes a hole;
//   2. an absent/unknown country falls to the BASE price, because failing to the
//      cheapest price costs margin while failing the other way is an overcharge;
//   3. EFT is unavailable to anyone NOT paying the base price — otherwise a US
//      buyer clicks the other button and takes a 45% discount.

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  process.env.SITE_URL = "https://app.example.com";
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";
  delete process.env.PAYFAST_MODE;
});

const PAYOUT = { accountHolder: "Y. Potch", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

// A completed, priced course whose owner is a ready Seller — the only state in
// which either rail will start. R100 base, $10 US, €10 EU.
async function fixture(t: ReturnType<typeof convexTest>, regional = true) {
  const alice = await t.run((ctx) => ctx.db.insert("users", { email: "alice@example.com" }));
  // The row's PRESENCE is the can-sell grant; `payout` is the second gate.
  // Both are needed for `isReadySeller`, which both rails enforce.
  await t.run((ctx) => ctx.db.insert("sellers", { userId: alice, payout: PAYOUT }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "tswana", title: "Basic Tswana", status: "completed" as const }),
  );
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>one</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "One", htmlStorageId });
  });
  await t.run((ctx) =>
    ctx.db.insert("listings", {
      topicId,
      lang: "en",
      amount: 10_000, // R100.00
      currency: "zar",
      ...(regional ? { usdAmount: 1000, eurAmount: 1000 } : {}), // $10.00 / €10.00
    }),
  );
  const bob = await t.run((ctx) => ctx.db.insert("users", { email: "bob@example.com" }));
  return { alice, bob, topicId };
}

// ---- region resolution: pure ------------------------------------------------

test("regionForCountry — US, Western Europe, and everything else", () => {
  expect(regionForCountry("US")).toBe("us");
  // The 27, sampled at both ends of the alphabet.
  expect(regionForCountry("DE")).toBe("eu");
  expect(regionForCountry("IE")).toBe("eu");
  expect(regionForCountry("SE")).toBe("eu");
  // Ticket 11 §5: "EU" is Western Europe by intent, not the 27 by letter.
  expect(regionForCountry("GB")).toBe("eu");
  expect(regionForCountry("CH")).toBe("eu");
  expect(regionForCountry("NO")).toBe("eu");
  expect(regionForCountry("IS")).toBe("eu");
  // Everywhere else, including home.
  expect(regionForCountry("ZA")).toBe("base");
  expect(regionForCountry("IN")).toBe("base");
  expect(regionForCountry("BR")).toBe("base");
});

test("regionForCountry — an absent or unrecognised country falls to the BASE price", () => {
  // Localhost never sets the header (ticket 10), so dev must resolve to
  // something, and the cheapest price is the safe direction to fail in.
  expect(regionForCountry(undefined)).toBe("base");
  expect(regionForCountry(null)).toBe("base");
  expect(regionForCountry("")).toBe("base");
  expect(regionForCountry("XX")).toBe("base");
  // Vercel sets an upper-case code; be liberal anyway rather than silently
  // charging a US buyer the base price over a casing difference.
  expect(regionForCountry("us")).toBe("us");
  expect(regionForCountry(" gb ")).toBe("eu");
});

// ---- the charge chokepoint: pure --------------------------------------------

test("chargeCents — the foreign price is exact and the Rand derives from it", () => {
  const listing = { amount: 10_000, usdAmount: 1000, eurAmount: 1000 };
  expect(chargeCents(listing, "base")).toBe(10_000);
  expect(chargeCents(listing, "us")).toBe(Math.round(1000 * USD_ZAR_RATE));
  expect(chargeCents(listing, "eu")).toBe(Math.round(1000 * EUR_ZAR_RATE));
  // The whole point of the ticket: the regional buyer pays MORE, not the same
  // money relabelled. If this ever equals the base price the feature is inert.
  expect(chargeCents(listing, "us")).toBeGreaterThan(chargeCents(listing, "base"));
});

test("chargeCents — an unset regional amount falls back to the base price", () => {
  // Every listing that exists today has neither field. They must keep working
  // untouched — this is what buys us no backfill and no migration.
  const bare = { amount: 10_000 };
  expect(chargeCents(bare, "us")).toBe(10_000);
  expect(chargeCents(bare, "eu")).toBe(10_000);
  expect(chargeCents(bare, "base")).toBe(10_000);
  // Partially priced: $ set, € not.
  expect(chargeCents({ amount: 10_000, usdAmount: 1000 }, "eu")).toBe(10_000);
});

test("chargeCents — always a whole cent, whatever the rate does", () => {
  // The rounding is the last float in the chain. A fractional cent reaching
  // PayFast is a signature mismatch, not a rounding nit.
  for (const usdAmount of [1, 7, 333, 999, 1234]) {
    const cents = chargeCents({ amount: 10_000, usdAmount }, "us");
    expect(Number.isInteger(cents)).toBe(true);
  }
});

// ---- the card rail freezes the REGIONAL amount ------------------------------

test("startCheckout — the intent freezes the regional amount, derived server-side", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);

  await asUser(t, bob).mutation(api.market.startCheckout, { topicSlug: "tswana", lang: "en", country: "US" });

  const intents = await t.run((ctx) => ctx.db.query("checkoutIntents").collect());
  expect(intents).toHaveLength(1);
  expect(intents[0].amount).toBe(Math.round(1000 * USD_ZAR_RATE));
});

test("startCheckout — no country means the base price, not a failure", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);

  await asUser(t, bob).mutation(api.market.startCheckout, { topicSlug: "tswana", lang: "en" });

  const intents = await t.run((ctx) => ctx.db.query("checkoutIntents").collect());
  expect(intents[0].amount).toBe(10_000);
});

test("startCheckout — the signed PayFast amount is the frozen regional amount", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);

  const { fields } = await asUser(t, bob).mutation(api.market.startCheckout, {
    topicSlug: "tswana",
    lang: "en",
    country: "DE",
  });

  // What PayFast is asked to charge must equal what we froze — the ITN match
  // compares them, so a divergence here is a payment that never fulfils.
  const amount = fields.find((f) => f.name === "amount")?.value;
  const expected = (Math.round(1000 * EUR_ZAR_RATE) / 100).toFixed(2);
  expect(amount).toBe(expected);
});

// ---- the EFT rail is base-price only ----------------------------------------

test("startEftPurchase — refused for a buyer who is not paying the base price", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);
  await t.run((ctx) => ctx.db.insert("operatorBank", { ...PAYOUT, enabled: true }));

  // The arbitrage this closes: a US buyer facing R180 by card could otherwise
  // click EFT and transfer R100 for the same Edition.
  await expect(
    asUser(t, bob).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en", country: "US" }),
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.query("eftIntents").collect())).toEqual([]);
});

test("startEftPurchase — a base-price buyer is unaffected, header or none", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);
  await t.run((ctx) => ctx.db.insert("operatorBank", { ...PAYOUT, enabled: true }));

  const za = await asUser(t, bob).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en", country: "ZA" });
  expect(za.amount).toBe(10_000);

  // Localhost sends no country. The operator testing in dev must not be locked
  // out of the rail they are trying to walk.
  const carol = await t.run((ctx) => ctx.db.insert("users", { email: "carol@example.com" }));
  const none = await asUser(t, carol).mutation(api.eft.startEftPurchase, { topicSlug: "tswana", lang: "en" });
  expect(none.amount).toBe(10_000);
});

// ---- the seller sets the foreign prices -------------------------------------

test("setEditionPrice — stores the foreign amounts alongside the ZAR base", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await fixture(t, false);

  await asUser(t, alice).mutation(api.market.setEditionPrice, {
    topicSlug: "tswana",
    lang: "en",
    amount: 10_000,
    currency: "ZAR",
    usdAmount: 1000,
    eurAmount: 1000,
  });

  const listing = await t.run((ctx) => ctx.db.query("listings").collect());
  expect(listing[0]).toMatchObject({ amount: 10_000, currency: "zar", usdAmount: 1000, eurAmount: 1000 });
  expect(topicId).toBeDefined();
});

test("setEditionPrice — clearing a regional price returns that region to the base", async () => {
  const t = convexTest(schema, modules);
  const { alice } = await fixture(t);

  // Omitting the field is how a seller un-sets a regional price; it must not be
  // read as "leave whatever was there", or a price can never be withdrawn.
  await asUser(t, alice).mutation(api.market.setEditionPrice, {
    topicSlug: "tswana",
    lang: "en",
    amount: 10_000,
    currency: "ZAR",
  });

  const listing = (await t.run((ctx) => ctx.db.query("listings").collect()))[0];
  expect(listing.usdAmount).toBeUndefined();
  expect(listing.eurAmount).toBeUndefined();
});

test("editionPricing — the seller's editor can read the foreign prices back", async () => {
  const t = convexTest(schema, modules);
  await fixture(t);

  // Without these on the payload the seller's form re-opens blank and a save
  // silently withdraws the regional prices they set last week.
  expect(await t.query(api.market.editionPricing, { topicSlug: "tswana" })).toEqual([
    { lang: "en", amount: 10_000, currency: "zar", usdAmount: 1000, eurAmount: 1000 },
  ]);
});

// ---- the buyer's surfaces are told the foreign prices -----------------------

test("courseHeader — the paygate payload carries the foreign prices, so the buyer can be quoted", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t);

  // The country cannot reach Convex through a reactive query subscription
  // (ticket 10), so the header ships all three price points and the surface
  // picks — `priceView()` in `src/app/_components/priceDerive.ts`.
  const hdr = await asUser(t, bob).query(api.content.reader.courseHeader, { topicSlug: "tswana", lang: "en" });
  expect(hdr!.paywall).toMatchObject({ amount: 10_000, currency: "zar", usdAmount: 1000, eurAmount: 1000 });
});

test("courseHeader — an edition with no regional prices carries neither field", async () => {
  const t = convexTest(schema, modules);
  const { bob } = await fixture(t, false);

  const hdr = await asUser(t, bob).query(api.content.reader.courseHeader, { topicSlug: "tswana", lang: "en" });
  expect(hdr!.paywall).toEqual({ amount: 10_000, currency: "zar", previewKey: "0001" });
});

test("setEditionPrice — a foreign amount gets the same bounds as the ZAR one", async () => {
  const t = convexTest(schema, modules);
  const { alice } = await fixture(t, false);
  const base = { topicSlug: "tswana", lang: "en", amount: 10_000, currency: "ZAR" };

  for (const usdAmount of [0, -100, 1.5, 100_000_001]) {
    await expect(asUser(t, alice).mutation(api.market.setEditionPrice, { ...base, usdAmount })).rejects.toThrow();
  }
  await expect(asUser(t, alice).mutation(api.market.setEditionPrice, { ...base, eurAmount: 0 })).rejects.toThrow();
});
