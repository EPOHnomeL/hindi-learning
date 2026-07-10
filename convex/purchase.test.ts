/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { signFields, verifySignature } from "./payfast";
import type { Id } from "./_generated/dataModel";

// Paid marketplace — the purchase-fulfilment seam (.scratch/payfast-payments).
// Access is granted ONLY by the verified PayFast ITN, which calls the idempotent
// `fulfillPurchase` — tested here directly, no network (the ITN HTTP boundary
// itself is ticket 04's seam). We assert external behaviour at the reader seam
// (what the buyer can read), the idempotency ledger (a replayed pf_payment_id
// never double-grants), the account-exists vs pending-then-claim split,
// lang-scoping, and the Allowlist admission of a paid email.

const modules = import.meta.glob("./**/*.ts");

// Mint an RS256 private key as a PKCS8 PEM via Web Crypto (no Node `crypto`
// import — the Convex default runtime has none). Convex Auth signs the session
// JWT with `JWT_PRIVATE_KEY` on sign-up.
beforeAll(async () => {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
  let bin = "";
  for (const b of pkcs8) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  process.env.JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${(b64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END PRIVATE KEY-----`;
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  process.env.SITE_URL = "https://app.example.com";
  // PayFast sandbox test-merchant credentials (public, from PayFast's docs).
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";
  delete process.env.PAYFAST_MODE; // → sandbox
});

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const }));
}
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number) {
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob([`<p>en ${key}</p>`], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, htmlStorageId });
  });
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, amount: number) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount, currency: "zar" }));
}
async function signUp(t: ReturnType<typeof convexTest>, email: string, password: string) {
  return await t.action(api.auth.signIn, { provider: "password", params: { email, password, flow: "signUp" } });
}
// A completed, English-priced course.
async function paidTopic(t: ReturnType<typeof convexTest>) {
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await price(t, topicId, "en", 120000);
  return { alice, topicId };
}

// ---- mint (a verified COMPLETE payment) --------------------------------------

// The money amounts a genuine ITN carries, in cents: PayFast's fee comes off the
// gross; the 50/50 split applies to the net (PLATFORM_FEE_BPS unset → 5000).
const MONEY = { gross: 120000, fee: 2760, net: 117240 };

async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(100));
}

test("fulfillPurchase (account exists) unlocks the Edition + writes the Ledger; idempotent on pf_payment_id", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");

  // Before: unentitled → the paygate (locked past the free Preview).
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  await t.mutation(internal.market.fulfillPurchase, {
    pfPaymentId: "pf_1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    ...MONEY,
  });

  // After: full read.
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
  // The same transaction wrote the Ledger: what the operator owes the author —
  // the ITN's gross/fee/net with net split 50/50, status owed.
  expect(await ledgerRows(t)).toMatchObject([
    {
      topicId,
      lang: "en",
      sellerId: alice,
      buyerEmail: "buyer@example.com",
      gross: 120000,
      fee: 2760,
      net: 117240,
      authorShare: 58620,
      platformShare: 58620,
      pfPaymentId: "pf_1",
      status: "owed",
    },
  ]);

  // Replay the SAME payment → no second grant and no second Ledger row (PayFast
  // re-delivers ITNs). A DIFFERENT payment for the same (buyer, Topic, language)
  // doesn't duplicate the Entitlement (dedup on the tuple).
  await t.mutation(internal.market.fulfillPurchase, {
    pfPaymentId: "pf_1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    ...MONEY,
  });
  await t.mutation(internal.market.fulfillPurchase, {
    pfPaymentId: "pf_2",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    ...MONEY,
  });
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents).toHaveLength(1);
  expect(ents[0]).toMatchObject({ pfPaymentId: "pf_1" });
});

test("a minted Entitlement is language-scoped — buying es doesn't unlock ur", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await price(t, topicId, "es", 120000);
  await price(t, topicId, "ur", 150000);
  const buyer = await seedUser(t, "buyer@example.com");

  await t.mutation(internal.market.fulfillPurchase, {
    pfPaymentId: "pf_es",
    topicId,
    lang: "es",
    email: "buyer@example.com",
    ...MONEY,
  });

  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "es" })).toMatchObject({
    locked: false,
  });
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "ur" })).toMatchObject({
    locked: true,
  });
});

test("a purchase with no account mints a pending Entitlement, claimed (and admitted) on sign-up", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);

  // Buyer has no account and is NOT on the Allowlist — payment is what admits them.
  await t.mutation(internal.market.fulfillPurchase, {
    pfPaymentId: "pf_9",
    topicId,
    lang: "en",
    email: "newbuyer@example.com",
    ...MONEY,
  });
  const pendingBefore = await t.run((ctx) =>
    ctx.db.query("pendingEntitlements").withIndex("by_email", (q) => q.eq("email", "newbuyer@example.com")).collect(),
  );
  expect(pendingBefore).toHaveLength(1);
  // A guest sale still writes the Ledger — the operator owes the author either way.
  expect(await ledgerRows(t)).toMatchObject([{ buyerEmail: "newbuyer@example.com", status: "owed" }]);

  // Sign up — the paid purchase admits them though sign-up is otherwise closed.
  await signUp(t, "newbuyer@example.com", "hunter2-strong");

  const { buyerId, ents, pendingAfter } = await t.run(async (ctx) => {
    const u = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", "newbuyer@example.com")).unique();
    const ents = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", u!._id))
      .collect();
    const pendingAfter = await ctx.db
      .query("pendingEntitlements")
      .withIndex("by_email", (q) => q.eq("email", "newbuyer@example.com"))
      .collect();
    return { buyerId: u!._id, ents, pendingAfter };
  });
  // The pending purchase became a real Entitlement carrying the PayFast payment
  // id (provenance back to the sale), and the pending row is cleared.
  expect(ents).toHaveLength(1);
  expect(ents[0]).toMatchObject({ lang: "en", pfPaymentId: "pf_9" });
  expect(pendingAfter).toEqual([]);
  expect(await asUser(t, buyerId).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });
});

test("payment is the ONLY new admission path — a stranger with no purchase is still rejected", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "someone@example.com" }); // table non-empty, closed to others
  await expect(signUp(t, "stranger@example.com", "hunter2-strong")).rejects.toThrow();
});

// ---- checkout initiation (ticket 03): the signed PayFast form ----------------

// A ready Seller (grant + payout bank details) selling a completed course.
async function sellableTopic(t: ReturnType<typeof convexTest>) {
  const { alice, topicId } = await paidTopic(t);
  await t.run((ctx) =>
    ctx.db.insert("sellers", {
      userId: alice,
      payout: { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" },
    }),
  );
  return { alice, topicId };
}

test("startCheckout returns the full signed field set for a priced Edition of a ready Seller", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await sellableTopic(t);

  // Available to Guests: no identity on the call. Email is normalised.
  const { action, fields: pairs } = await t.mutation(api.market.startCheckout, {
    topicSlug: "hindi",
    lang: "en",
    email: "  Buyer@Example.COM ",
  });

  // The hosted process URL, sandbox by default.
  expect(action).toBe("https://sandbox.payfast.co.za/eng/process");
  // Fields come back as ORDERED pairs — Convex sorts object keys, and PayFast
  // signs over the field order, so a record would corrupt the signature. The
  // client posts them in exactly this order.
  expect(pairs.map((p) => p.name)).toEqual([
    "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
    "email_address", "m_payment_id", "amount", "item_name", "custom_str1", "custom_str2",
    "signature",
  ]);
  const fields = Object.fromEntries(pairs.map((p) => [p.name, p.value]));
  // The amount is the stored listing rendered as 2-decimal Rand (paidTopic
  // prices at 120000 cents), addressed to the platform's merchant account.
  expect(fields).toMatchObject({
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "1200.00",
    email_address: "buyer@example.com",
    custom_str1: topicId,
    custom_str2: "en",
  });
  expect(fields.item_name).toContain("hindi"); // the course title
  expect(fields.m_payment_id).toBeTruthy();
  // Same-origin return/cancel (via appUrl); the notify URL points at the ITN route.
  expect(fields.return_url).toMatch(/^https:\/\/app\.example\.com\//);
  expect(fields.cancel_url).toMatch(/^https:\/\/app\.example\.com\//);
  expect(fields.notify_url).toBe("https://example.convex.site/payfast/notify");
  // The signature is verifiable by the pure module — PayFast will accept it.
  expect(verifySignature(fields, "jt7NOE43FZPn")).toBe(true);

  // A checkout-intent row links m_payment_id → (email, topic, lang) for the
  // return page to prefill+lock the sign-up email without racing the ITN.
  const intent = await t.run((ctx) =>
    ctx.db
      .query("checkoutIntents")
      .withIndex("by_m_payment_id", (q) => q.eq("mPaymentId", fields.m_payment_id!))
      .unique(),
  );
  expect(intent).toMatchObject({ email: "buyer@example.com", topicId, lang: "en" });
});

test("startCheckout rejects an unpriced Edition, a not-ready Seller, and a bad email", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await sellableTopic(t);

  // Priced (en) but the ur Edition is not → refused.
  await expect(
    t.mutation(api.market.startCheckout, { topicSlug: "hindi", lang: "ur", email: "b@example.com" }),
  ).rejects.toThrow();

  // A garbage email → refused before anything is written.
  await expect(
    t.mutation(api.market.startCheckout, { topicSlug: "hindi", lang: "en", email: "not-an-email" }),
  ).rejects.toThrow();

  // The Seller loses readiness (bank details gone) → the priced Edition stops selling.
  await t.run(async (ctx) => {
    const alice = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", "alice@example.com")).unique();
    const row = await ctx.db.query("sellers").withIndex("by_user", (q) => q.eq("userId", alice!._id)).unique();
    await ctx.db.patch(row!._id, { payout: undefined });
  });
  await expect(
    t.mutation(api.market.startCheckout, { topicSlug: "hindi", lang: "en", email: "b@example.com" }),
  ).rejects.toThrow();

  // Nothing was persisted by the rejected attempts.
  const intents = await t.run((ctx) => ctx.db.query("checkoutIntents").collect());
  expect(intents).toEqual([]);
  void topicId;
});

// ---- the ITN HTTP boundary (ticket 04): the sole grantor of paid access ------

afterEach(() => {
  vi.unstubAllGlobals();
});

// Stub the ONE network call on the rail — the server postback to PayFast's
// /eng/query/validate — at the action boundary, capturing what was sent.
function mockValidate(reply: string, capture?: { url?: string; body?: string }) {
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (capture) {
      capture.url = String(url);
      capture.body = String(init?.body ?? "");
    }
    return new Response(reply, { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// A genuine ITN field set for `topicId` (custom_str1/2 carry what to grant),
// signed with the sandbox passphrase — in PayFast's ITN field order.
function itnFields(topicId: string, over: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    m_payment_id: "mp_1",
    pf_payment_id: "pf_100",
    payment_status: "COMPLETE",
    item_name: "hindi — English edition",
    amount_gross: "1200.00",
    amount_fee: "-27.60",
    amount_net: "1172.40",
    custom_str1: topicId,
    custom_str2: "en",
    email_address: "buyer@example.com",
    merchant_id: "10000100",
    ...over,
  };
  return { ...base, signature: signFields(base, "jt7NOE43FZPn") };
}

async function postItn(t: ReturnType<typeof convexTest>, fields: Record<string, string>) {
  return await t.fetch("/payfast/notify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

// Every table the ITN may write, for the "nothing written" assertions.
async function itnWrites(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ({
    events: await ctx.db.query("payfastEvents").take(10),
    ledger: await ctx.db.query("ledger").take(10),
    ents: await ctx.db.query("entitlements").take(10),
    pending: await ctx.db.query("pendingEntitlements").take(10),
  }));
}

test("ITN: a missing or forged signature → 400, nothing written, no postback attempted", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  const fetchMock = mockValidate("VALID");

  // No signature at all.
  const { signature: _sig, ...unsigned } = itnFields(topicId);
  expect((await postItn(t, unsigned)).status).toBe(400);

  // A forged signature (tampered amount, stale signature).
  const forged = itnFields(topicId);
  forged.amount_gross = "0.01";
  expect((await postItn(t, forged)).status).toBe(400);

  expect(await itnWrites(t)).toEqual({ events: [], ledger: [], ents: [], pending: [] });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("ITN: a postback that does not return VALID → rejected, nothing written", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  mockValidate("INVALID");

  expect((await postItn(t, itnFields(topicId))).status).toBe(400);
  expect(await itnWrites(t)).toEqual({ events: [], ledger: [], ents: [], pending: [] });
});

test("ITN: an amount that doesn't match the stored listing → rejected", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t); // listed at 1200.00
  const fetchMock = mockValidate("VALID");

  // Signed correctly — the buyer paid a genuine 500.00, but that's not the price.
  expect((await postItn(t, itnFields(topicId, { amount_gross: "500.00" }))).status).toBe(400);
  expect(await itnWrites(t)).toEqual({ events: [], ledger: [], ents: [], pending: [] });
  expect(fetchMock).not.toHaveBeenCalled(); // cheaper checks run before the network hop
});

test("ITN: a genuine COMPLETE notification grants once + writes the Ledger; replay is a no-op", async () => {
  const t = convexTest(schema, modules);
  const { alice, topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");
  const capture: { url?: string; body?: string } = {};
  mockValidate("VALID", capture);

  expect((await postItn(t, itnFields(topicId))).status).toBe(200);

  // The postback went to the sandbox validate URL, re-sending the received
  // fields minus the signature.
  expect(capture.url).toBe("https://sandbox.payfast.co.za/eng/query/validate");
  expect(capture.body).toContain("pf_payment_id=pf_100");
  expect(capture.body).not.toContain("signature=");

  // Access granted at the reader seam + the Ledger row in the same transaction.
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });
  expect(await ledgerRows(t)).toMatchObject([
    { sellerId: alice, gross: 120000, fee: 2760, net: 117240, authorShare: 58620, platformShare: 58620, status: "owed" },
  ]);

  // PayFast re-delivers → same 200, no double grant, no second Ledger row.
  expect((await postItn(t, itnFields(topicId))).status).toBe(200);
  expect(await ledgerRows(t)).toHaveLength(1);
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents).toHaveLength(1);
});

test("ITN: a non-COMPLETE payment_status is acknowledged but grants nothing", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  mockValidate("VALID");

  expect((await postItn(t, itnFields(topicId, { payment_status: "CANCELLED" }))).status).toBe(200);
  expect(await itnWrites(t)).toEqual({ events: [], ledger: [], ents: [], pending: [] });
});
