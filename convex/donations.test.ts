/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { signFields, verifySignature } from "./payfast";
import { DONATION_FEE_BPS, MIN_DONATION_USD_CENTS, USD_ZAR_RATE } from "./donations";
import type { Id } from "./_generated/dataModel";

// The **donation rail** (ADR 0027) — the other way money enters the platform.
// A Guest types dollars, is charged Rand through the operator's PayFast account,
// and the operator keeps 10% of net and owes the rest to the tenant's nominated
// payee through the existing Ledger + Payouts tab.
//
// The three things that must hold and would be expensive to get wrong:
//   1. a donation ITN writes ONE ledger row and mints NO Entitlement;
//   2. the Sales tab never sees a donation row (it groups by course);
//   3. the fee is 10%, not `PLATFORM_FEE_BPS`'s 50%.

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  process.env.SITE_URL = "https://app.example.com";
  // PayFast sandbox test-merchant credentials (public, from PayFast's docs).
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";
  delete process.env.PAYFAST_MODE; // → sandbox
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PLATFORM_FEE_BPS;
});

const PASSPHRASE = "jt7NOE43FZPn";
const PAYOUT = { accountHolder: "Y. Potch", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };
const THEME = { light: {} as Record<string, string> };
const FLAGS = { certificates: true, translations: true, publicLinks: true, qa: true, seeding: true };

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}

// A tenant with donations LIVE: a payee who is a ready Seller (grant + bank
// details) and the flag on — the only state in which a donation may be taken.
async function donatableTenant(t: ReturnType<typeof convexTest>, slug = "ywampotch") {
  const payee = await t.run((ctx) => ctx.db.insert("users", { email: "payee@example.com" }));
  await t.run((ctx) => ctx.db.insert("sellers", { userId: payee, payout: PAYOUT }));
  await t.run((ctx) =>
    ctx.db.insert("tenants", {
      slug,
      displayName: "YWAM Potch",
      theme: THEME,
      flags: { ...FLAGS, donations: true },
      donationPayee: payee,
    }),
  );
  return { payee, slug };
}

async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(100));
}

// ---- the signed-fields query ------------------------------------------------

test("checkoutFields signs a Guest donation with the tenant + donation custom fields, and writes NOTHING", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);

  // ANONYMOUS — no identity. The donor is a Guest (ADR 0021's auth-first rule
  // has no subject: a donation grants nothing there is an account to attach to).
  const res = await t.query(api.donations.checkoutFields, { tenantSlug: "ywampotch", usdCents: 5000 });
  const fields = Object.fromEntries(res.fields.map((f) => [f.name, f.value]));

  // $50 charged as Rand at the committed constant, and the query hands back the
  // very number it signed so the widget's anti-surprise line can't disagree.
  expect(res.zarCents).toBe(Math.round(5000 * USD_ZAR_RATE));
  expect(fields.amount).toBe(`${Math.floor(res.zarCents / 100)}.${String(res.zarCents % 100).padStart(2, "0")}`);

  // The entire mechanism: the ITN reads these two back to know what to do.
  expect(fields.custom_str1).toBe("ywampotch");
  expect(fields.custom_str2).toBe("donation");
  // No email field (PayFast collects it) and no intent reference (no price to freeze).
  expect(fields.email_address).toBeUndefined();
  expect(fields.m_payment_id).toBeUndefined();
  // PayFast will accept the signature, and it covers the custom fields — so the
  // tenant slug cannot be swapped in flight to redirect the money.
  expect(verifySignature(fields, PASSPHRASE)).toBe(true);
  expect(res.action).toBe("https://sandbox.payfast.co.za/eng/process");

  // Both round-trip URLs land on the DEDICATED /donate page, on the tenant's own
  // host (ADR 0025 makes sessions host-only, so the return must not cross hosts).
  //
  // **They used to carry `#donations` and point at `/`, and that was a live bug**
  // (spec-donate-route.md, 2026-08-02): the donor came back to a landing page
  // where <DonateSection/> mounts only after its queries resolve, so the browser
  // found no anchor and never scrolled — and the thank-you lives INSIDE that
  // section. A donor who had just paid saw the hero and assumed nothing happened.
  // Signed in it was worse: `/` is the Dashboard, which has no section at all.
  // A dedicated page has nothing to scroll to, which is exactly why it works.
  expect(fields.return_url).toBe("https://ywampotch.app.example.com/donate?donation=thanks");
  expect(fields.cancel_url).toBe("https://ywampotch.app.example.com/donate");

  // The whole point of it being a QUERY: nothing was persisted before the money
  // is real, so an anonymous caller has no junk-row abuse surface.
  expect(await t.run((ctx) => ctx.db.query("ledger").take(5))).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("payfastEvents").take(5))).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("checkoutIntents").take(5))).toEqual([]);
});

test("checkoutFields refuses below the minimum, a non-integer, and an absurd amount", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);

  for (const usdCents of [0, -100, MIN_DONATION_USD_CENTS - 1, 12.5, 2_000_000]) {
    await expect(t.query(api.donations.checkoutFields, { tenantSlug: "ywampotch", usdCents })).rejects.toThrow();
  }
  // The floor itself is accepted.
  await expect(
    t.query(api.donations.checkoutFields, { tenantSlug: "ywampotch", usdCents: MIN_DONATION_USD_CENTS }),
  ).resolves.toBeTruthy();
});

test("checkoutFields fails closed: unknown tenant, flag off, no payee, or a payee who stopped being ready", async () => {
  const t = convexTest(schema, modules);
  const { payee } = await donatableTenant(t);
  const ask = () => t.query(api.donations.checkoutFields, { tenantSlug: "ywampotch", usdCents: 5000 });

  // Unknown slug — fail closed, like assertTenantFlag.
  await expect(t.query(api.donations.checkoutFields, { tenantSlug: "nobody", usdCents: 5000 })).rejects.toThrow();

  const tenant = await t.run((ctx) => ctx.db.query("tenants").first());
  // Flag off.
  await t.run((ctx) => ctx.db.patch(tenant!._id, { flags: { ...FLAGS, donations: false } }));
  await expect(ask()).rejects.toThrow();
  await t.run((ctx) => ctx.db.patch(tenant!._id, { flags: { ...FLAGS, donations: true } }));

  // Flag on but no payee.
  await t.run((ctx) => ctx.db.patch(tenant!._id, { donationPayee: undefined }));
  await expect(ask()).rejects.toThrow();
  await t.run((ctx) => ctx.db.patch(tenant!._id, { donationPayee: payee }));
  await expect(ask()).resolves.toBeTruthy();

  // The payee's bank details are cleared AFTER the flag went on — readiness is
  // re-checked live at the moment of the ask, never cached into the flag.
  const seller = await t.run((ctx) => ctx.db.query("sellers").first());
  await t.run((ctx) => ctx.db.patch(seller!._id, { payout: undefined }));
  await expect(ask()).rejects.toThrow();
});

test("checkoutFields respects the platform-wide PayFast pause", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);
  process.env.PAYFAST_MODE = "off";
  try {
    await expect(t.query(api.donations.checkoutFields, { tenantSlug: "ywampotch", usdCents: 5000 })).rejects.toThrow();
  } finally {
    delete process.env.PAYFAST_MODE;
  }
});

// ---- the ITN donation branch ------------------------------------------------

function mockValidate(reply: string) {
  const fn = vi.fn(async () => new Response(reply, { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

// A genuine donation ITN, signed with the sandbox passphrase. No `m_payment_id`
// — the donation checkout sends none, because there is no intent to reference.
function donationItn(over: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    pf_payment_id: "pf_don_1",
    payment_status: "COMPLETE",
    item_name: "Donation to YWAM Potch",
    amount_gross: "920.00",
    amount_fee: "-25.00",
    amount_net: "895.00",
    custom_str1: "ywampotch",
    custom_str2: "donation",
    email_address: "Donor@Example.com",
    merchant_id: "10000100",
    ...over,
  };
  return { ...base, signature: signFields(base, PASSPHRASE) };
}

async function postItn(t: ReturnType<typeof convexTest>, fields: Record<string, string>) {
  return await t.fetch("/payfast/notify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

test("ITN: a verified donation writes ONE donation ledger row owed to the payee, mints NO Entitlement, and replays as a no-op", async () => {
  const t = convexTest(schema, modules);
  const { payee } = await donatableTenant(t);
  // The global sale split is 50/50 — if the donation rail reused it, half of
  // every donation would silently vanish. This is the trap the test exists for.
  process.env.PLATFORM_FEE_BPS = "5000";
  mockValidate("VALID");

  expect((await postItn(t, donationItn())).status).toBe(200);

  const rows = await ledgerRows(t);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "donation",
    sellerId: payee,
    // PayFast collected the donor's email on its own page and handed it back —
    // normalised on the way in, like every other email in the system.
    buyerEmail: "donor@example.com",
    gross: 92000,
    fee: 2500, // normalised positive from the ITN's "-25.00"
    net: 89500,
    // 10% of NET via DONATION_FEE_BPS — NOT the 50% PLATFORM_FEE_BPS above.
    platformShare: 8950,
    sellerShare: 80550,
    pfPaymentId: "pf_don_1",
    status: "owed",
  });
  // A donation buys no Edition: no course, no language, and above all no grant.
  expect(rows[0]!.topicId).toBeUndefined();
  expect(rows[0]!.lang).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("entitlements").take(10))).toEqual([]);

  // PayFast re-delivers → same 200, still exactly one row (idempotency is the
  // shared payfastEvents table, keyed on pf_payment_id, unchanged).
  expect((await postItn(t, donationItn())).status).toBe(200);
  expect(await ledgerRows(t)).toHaveLength(1);
});

test("ITN: a donation is rejected without the postback, on a forged signature, and when not COMPLETE", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);

  // A tampered slug — someone trying to redirect the money to another tenant —
  // invalidates the signature, so it never reaches the acceptance rules.
  const forged = donationItn();
  forged.custom_str1 = "someone-else";
  mockValidate("VALID");
  expect((await postItn(t, forged)).status).toBe(400);
  expect(await ledgerRows(t)).toEqual([]);

  // Correctly signed, but PayFast doesn't own up to sending it.
  mockValidate("INVALID");
  expect((await postItn(t, donationItn())).status).toBe(400);
  expect(await ledgerRows(t)).toEqual([]);

  // A genuine non-COMPLETE notification is acknowledged (so PayFast stops
  // re-sending) and records nothing.
  const fetchMock = mockValidate("VALID");
  expect((await postItn(t, donationItn({ payment_status: "CANCELLED" }))).status).toBe(200);
  expect(await ledgerRows(t)).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("ITN: a donation for a tenant with no ready payee is NOT banked silently — it 500s so PayFast retries", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);
  const tenant = await t.run((ctx) => ctx.db.query("tenants").first());
  // The payee was cleared while the donor was on PayFast's page.
  await t.run((ctx) => ctx.db.patch(tenant!._id, { donationPayee: undefined }));
  mockValidate("VALID");

  expect((await postItn(t, donationItn())).status).toBe(500);
  // The rollback took the idempotency row with it, so the retry re-runs whole.
  expect(await ledgerRows(t)).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("payfastEvents").take(5))).toEqual([]);
});

test("fulfillDonation refuses non-integer or negative money", async () => {
  const t = convexTest(schema, modules);
  await donatableTenant(t);
  await expect(
    t.mutation(internal.donations.fulfillDonation, {
      pfPaymentId: "pf_x",
      tenantSlug: "ywampotch",
      donorEmail: "d@example.com",
      gross: 92000,
      fee: -1,
      net: 89500,
    }),
  ).rejects.toThrow();
});

// ---- the tabs: Sales excludes, Payouts includes -----------------------------

test("the Sales tab provably EXCLUDES donations while the Payouts tab includes them", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const { payee } = await donatableTenant(t);

  // One real sale…
  const author = await t.run((ctx) => ctx.db.insert("users", { email: "author@example.com" }));
  await t.run((ctx) => ctx.db.insert("sellers", { userId: author, payout: PAYOUT }));
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId, lang: "en", sellerId: author, buyerEmail: "b@example.com",
      gross: 120000, fee: 2760, net: 117240, sellerShare: 58620, platformShare: 58620,
      pfPaymentId: "pf_1", kind: "sale" as const, status: "owed" as const,
    }),
  );
  // …a LEGACY sale with no `kind` at all (written before ADR 0027). It must NOT
  // vanish from the report — this is why the filter reads "not a donation".
  await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId, lang: "en", sellerId: author, buyerEmail: "c@example.com",
      gross: 120000, fee: 2760, net: 117240, sellerShare: 58620, platformShare: 58620,
      pfPaymentId: "pf_2", status: "owed" as const,
    }),
  );
  // …and a donation, which has NO topicId — the row that crashes or reads
  // "(deleted course)" if either Sales query ever sees it.
  await t.run((ctx) =>
    ctx.db.insert("ledger", {
      sellerId: payee, buyerEmail: "donor@example.com",
      gross: 92000, fee: 2500, net: 89500, sellerShare: 80550, platformShare: 8950,
      pfPaymentId: "pf_don_1", kind: "donation" as const, status: "owed" as const,
    }),
  );

  // Sales: both sales, no donation — 240000 gross, not 332000.
  const report = await asUser(t, admin).query(api.sales.report, {});
  expect(report).toHaveLength(1);
  expect(report[0]).toMatchObject({ courseTitle: "Hindi", gross: 240000, count: 2 });

  const byDay = await asUser(t, admin).query(api.sales.byDay, {});
  expect(byDay.reduce((sum, d) => sum + d.gross, 0)).toBe(240000);
  expect(byDay.flatMap((d) => d.editions).every((e) => e.lang === "en")).toBe(true);

  // Payouts: the donation is owed to the payee, alongside the author's sales —
  // for free, because that rollup groups by sellerId and never sees a course.
  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  const donor = owed.find((o) => o.email === "payee@example.com");
  expect(donor).toMatchObject({ totalOwed: 80550, payout: PAYOUT });
  // A donation has no Edition, so `lang` is null and `kind` is what the UI reads.
  expect(donor!.sales[0]).toMatchObject({ lang: null, kind: "donation" });
  // The author's rows still read as sales, legacy row included.
  const seller = owed.find((o) => o.email === "author@example.com");
  expect(seller!.sales.map((s) => s.kind)).toEqual(["sale", "sale"]);
  expect(seller!.sales.every((s) => s.lang === "en")).toBe(true);
});

// ---- the sys-admin config gates ---------------------------------------------

test("the donations flag and payee are sys-admin-only and cannot be switched on without a ready payee", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  // A TENANT admin — scoped to ywampotch, and explicitly not allowed near this.
  const tenantAdmin = await t.run((ctx) => ctx.db.insert("users", { email: "ta@example.com" }));
  await t.run((ctx) =>
    ctx.db.insert("whitelist", { email: "ta@example.com", isAdmin: true, tenantSlug: "ywampotch" }),
  );
  const payee = await t.run((ctx) => ctx.db.insert("users", { email: "payee@example.com" }));
  await t.run((ctx) =>
    ctx.db.insert("tenants", { slug: "ywampotch", displayName: "YWAM Potch", theme: THEME, flags: FLAGS }),
  );

  // A tenant admin must not redirect their own tenant's donation income.
  await expect(
    asUser(t, tenantAdmin).mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "ta@example.com" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, tenantAdmin).mutation(api.tenantFlags.setTenantFlags, { tenantSlug: "ywampotch", flags: { donations: true } }),
  ).rejects.toThrow();

  const sys = asUser(t, admin);
  // The flag can't go on with no payee at all.
  await expect(sys.mutation(api.tenantFlags.setTenantFlags, { tenantSlug: "ywampotch", flags: { donations: true } }))
    .rejects.toThrow();
  // A payee who isn't a ready Seller is refused — no seller row yet.
  await expect(sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "payee@example.com" }))
    .rejects.toThrow();
  // Granted can-sell, but still no bank details: still refused.
  const sellerRow = await t.run((ctx) => ctx.db.insert("sellers", { userId: payee }));
  await expect(sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "payee@example.com" }))
    .rejects.toThrow();

  // Grant + bank details → the payee sticks, and only then may the flag go on.
  await t.run((ctx) => ctx.db.patch(sellerRow, { payout: PAYOUT }));
  await sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "payee@example.com" });
  await sys.mutation(api.tenantFlags.setTenantFlags, { tenantSlug: "ywampotch", flags: { donations: true } });
  let tenant = await t.run((ctx) => ctx.db.query("tenants").first());
  expect(tenant).toMatchObject({ donationPayee: payee, flags: { donations: true } });

  // Clearing the payee also switches the flag off — a live flag with no payee
  // would fail at donor time instead of at configuration time.
  await sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch" });
  tenant = await t.run((ctx) => ctx.db.query("tenants").first());
  expect(tenant!.donationPayee).toBeUndefined();
  expect(tenant!.flags.donations).toBe(false);
});

// The bug this pins was found in PROD, not in a test: the flag refused to switch
// on and the admin panel showed "Server Error", because a production Convex
// deployment redacts a plain `Error`'s message before it reaches the client.
// Only `ConvexError`'s data survives, so any refusal the OPERATOR is meant to act
// on has to be one — a `new Error` here is invisible where it matters.
test("the operator-facing refusals are ConvexError, so prod shows them instead of 'Server Error'", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  await t.run((ctx) => ctx.db.insert("users", { email: "payee@example.com" }));
  await t.run((ctx) =>
    ctx.db.insert("tenants", { slug: "ywampotch", displayName: "YWAM Potch", theme: THEME, flags: FLAGS }),
  );
  const sys = asUser(t, admin);

  for (const call of [
    () => sys.mutation(api.tenantFlags.setTenantFlags, { tenantSlug: "ywampotch", flags: { donations: true } }),
    () => sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "nobody@example.com" }),
    () => sys.mutation(api.tenantDonations.setDonationPayee, { tenantSlug: "ywampotch", email: "payee@example.com" }),
  ]) {
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConvexError);
    // …and the payload is the sentence the operator reads, not an opaque code.
    expect(typeof (err as ConvexError<string>).data).toBe("string");
  }
});

test("a tenant with no donations flag set at all is off — absence is fail-closed, no backfill needed", async () => {
  const t = convexTest(schema, modules);
  // Exactly the shape every existing tenant row has today: five flags, no sixth.
  await t.run((ctx) =>
    ctx.db.insert("tenants", { slug: "legacy", displayName: "Legacy", theme: THEME, flags: FLAGS }),
  );
  await expect(t.query(api.donations.checkoutFields, { tenantSlug: "legacy", usdCents: 5000 })).rejects.toThrow();
});

// ---- the constants ----------------------------------------------------------

test("the donation fee is 10% of net and is NOT the global sale split", async () => {
  expect(DONATION_FEE_BPS).toBe(1000);
  // If someone ever "simplifies" this to PLATFORM_FEE_BPS, this fails: that var
  // is 5000, and half of every donation would quietly go to the platform.
  process.env.PLATFORM_FEE_BPS = "5000";
  const t = convexTest(schema, modules);
  await donatableTenant(t);
  mockValidate("VALID");
  await postItn(t, donationItn());
  const [row] = await ledgerRows(t);
  expect(row!.platformShare * 10).toBe(row!.net);
});
