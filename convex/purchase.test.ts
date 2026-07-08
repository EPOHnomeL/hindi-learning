/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { appUrl } from "./stripe";
import type { Id } from "./_generated/dataModel";

// Paid marketplace — Slice 3 (Purchase) + Slice 4 (refund revoke), ADR 0016.
// Seam 2 of the PRD: the purchase lifecycle. Access is granted ONLY by the
// verified webhook, which calls two idempotent internal mutations — tested here
// directly (Stripe mocked at the action boundary; no test calls the Stripe API).
// We assert external behaviour at the reader seam (what the buyer can read), the
// idempotency ledger (a replay never double-grants/revokes), the account-exists
// vs pending-then-claim split, lang-scoping, Allowlist admission of a paid email,
// and that the HTTP webhook rejects an unverified signature.

const modules = import.meta.glob("./**/*.ts");

// Mint an RS256 private key as a PKCS8 PEM via Web Crypto (no Node `crypto`
// import — the Convex default runtime has none). Convex Auth signs the session
// JWT with `JWT_PRIVATE_KEY` on sign-up; the Stripe secrets must be present so a
// bad-signature webhook is genuinely verified-and-rejected, not short-circuited.
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
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
});

// Sign a payload with the Stripe scheme (t=<ts>,v1=<hmac_sha256(ts.payload)>) and
// POST it to the webhook — a genuinely verified event, so we exercise the real
// dispatch (event routing, payment_status / full-refund gating, metadata read).
async function signedWebhook(t: ReturnType<typeof convexTest>, payload: string) {
  const ts = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("whsec_dummy"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return await t.fetch("/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${ts},v1=${hex}` },
    body: payload,
  });
}

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
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, html: `<p>en ${key}</p>` }));
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, amount: number, currency: string) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount, currency }));
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
  await price(t, topicId, "en", 1200, "usd");
  return { alice, topicId };
}

// ---- mint (checkout.session.completed) --------------------------------------

test("webhook mint (account exists) unlocks the Edition; idempotent on event id", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");

  // Before: unentitled → the paygate (locked past the free Preview).
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "evt_1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    paymentIntentId: "pi_1",
  });

  // After: full read.
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    html: "<p>en 0002</p>",
    locked: false,
  });

  // Replay the SAME event → no second grant. A DIFFERENT event for the same
  // (buyer, Topic, language) also doesn't duplicate (dedup on the tuple).
  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "evt_1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    paymentIntentId: "pi_1",
  });
  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "evt_2",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    paymentIntentId: "pi_1",
  });
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents).toHaveLength(1);
});

test("a minted Entitlement is language-scoped — buying es doesn't unlock ur", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await price(t, topicId, "es", 1200, "usd");
  await price(t, topicId, "ur", 1500, "usd");
  const buyer = await seedUser(t, "buyer@example.com");

  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "evt_es",
    topicId,
    lang: "es",
    email: "buyer@example.com",
    paymentIntentId: "pi_es",
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
    eventId: "evt_1",
    topicId,
    lang: "en",
    email: "newbuyer@example.com",
    paymentIntentId: "pi_9",
  });
  const pendingBefore = await t.run((ctx) =>
    ctx.db.query("pendingEntitlements").withIndex("by_email", (q) => q.eq("email", "newbuyer@example.com")).collect(),
  );
  expect(pendingBefore).toHaveLength(1);

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
  // The pending purchase became a real Entitlement carrying the PaymentIntent
  // (so a later refund still revokes it), and the pending row is cleared.
  expect(ents).toHaveLength(1);
  expect(ents[0]).toMatchObject({ lang: "en", stripePaymentIntentId: "pi_9" });
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

// ---- refund / dispute revoke (defensive; no refund UI) ----------------------

test("refund revokes only the matching PaymentIntent; replay is a no-op; other purchases untouched", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await price(t, topicId, "en", 1200, "usd");
  await price(t, topicId, "ur", 1500, "usd");
  const buyer = await seedUser(t, "buyer@example.com");
  await t.mutation(internal.market.fulfillPurchase, { eventId: "b_en", topicId, lang: "en", email: "buyer@example.com", paymentIntentId: "pi_en" });
  await t.mutation(internal.market.fulfillPurchase, { eventId: "b_ur", topicId, lang: "ur", email: "buyer@example.com", paymentIntentId: "pi_ur" });

  // Refund the English purchase → English drops back to the paygate…
  await t.mutation(internal.market.revokePurchaseByPaymentIntent, { eventId: "r1", paymentIntentId: "pi_en" });
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "en" })).toMatchObject({
    locked: true,
  });
  // …but the Urdu purchase is untouched.
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002", lang: "ur" })).toMatchObject({
    locked: false,
  });

  // Replaying the refund event is a no-op (idempotent on the event id).
  await t.mutation(internal.market.revokePurchaseByPaymentIntent, { eventId: "r1", paymentIntentId: "pi_en" });
  const ents = await t.run((ctx) =>
    ctx.db.query("entitlements").withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", buyer)).collect(),
  );
  expect(ents.map((e) => e.lang)).toEqual(["ur"]);
});

test("a refund before sign-up removes the pending Entitlement", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  await t.mutation(internal.market.fulfillPurchase, { eventId: "b1", topicId, lang: "en", email: "new@example.com", paymentIntentId: "pi_x" });
  await t.mutation(internal.market.revokePurchaseByPaymentIntent, { eventId: "r1", paymentIntentId: "pi_x" });
  const pending = await t.run((ctx) =>
    ctx.db.query("pendingEntitlements").withIndex("by_payment_intent", (q) => q.eq("stripePaymentIntentId", "pi_x")).collect(),
  );
  expect(pending).toEqual([]);
});

// ---- the webhook boundary: an unverified event never grants -----------------

test("the webhook rejects a missing or bad Stripe signature", async () => {
  const t = convexTest(schema, modules);

  // No signature header → 400.
  const noSig = await t.fetch("/stripe/webhook", { method: "POST", body: "{}" });
  expect(noSig.status).toBe(400);

  // Present but forged signature → verification fails → 400 (never processed).
  const badSig = await t.fetch("/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ id: "evt_forged", type: "checkout.session.completed" }),
  });
  expect(badSig.status).toBe(400);
  // Nothing reached a mutation — the idempotency ledger has no row for it.
  const seen = await t.run((ctx) =>
    ctx.db.query("stripeEvents").withIndex("by_event", (q) => q.eq("eventId", "evt_forged")).collect(),
  );
  expect(seen).toEqual([]);
});

test("a signed checkout webhook mints access end-to-end (completed AND async success)", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");
  const asyncBuyer = await seedUser(t, "later@example.com");

  // A genuinely-signed completed+paid session mints the Entitlement.
  const completed = JSON.stringify({
    id: "evt_c",
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "paid",
        payment_intent: "pi_c",
        customer_details: { email: "buyer@example.com" },
        metadata: { topicId, lang: "en" },
      },
    },
  });
  expect((await signedWebhook(t, completed)).status).toBe(200);
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });

  // A delayed method's `async_payment_succeeded` (its `completed` arrived unpaid)
  // also grants — otherwise the buyer is charged with no access.
  const asyncPaid = JSON.stringify({
    id: "evt_a",
    type: "checkout.session.async_payment_succeeded",
    data: {
      object: {
        payment_status: "paid",
        payment_intent: "pi_a",
        customer_details: { email: "later@example.com" },
        metadata: { topicId, lang: "en" },
      },
    },
  });
  expect((await signedWebhook(t, asyncPaid)).status).toBe(200);
  expect(await asUser(t, asyncBuyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });
});

test("a partial refund leaves access intact; a full refund revokes it", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");
  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "b1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    paymentIntentId: "pi_ref",
  });

  // Partial refund (a $1 goodwill refund on a $12 charge) → access untouched.
  const partial = JSON.stringify({
    id: "evt_partial",
    type: "charge.refunded",
    data: { object: { payment_intent: "pi_ref", amount: 1200, amount_refunded: 100 } },
  });
  expect((await signedWebhook(t, partial)).status).toBe(200);
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });

  // Full refund → access revoked, back to the paygate.
  const full = JSON.stringify({
    id: "evt_full",
    type: "charge.refunded",
    data: { object: { payment_intent: "pi_ref", amount: 1200, amount_refunded: 1200 } },
  });
  expect((await signedWebhook(t, full)).status).toBe(200);
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });
});

test("a dispute revokes access only when it is closed as lost, not when merely opened or won", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await paidTopic(t);
  const buyer = await seedUser(t, "buyer@example.com");
  await t.mutation(internal.market.fulfillPurchase, {
    eventId: "d1",
    topicId,
    lang: "en",
    email: "buyer@example.com",
    paymentIntentId: "pi_dis",
  });

  // A dispute the Seller WON (closed, status "won") → access untouched: a chargeback
  // that resolved in the Seller's favour never withdrew the money.
  const won = JSON.stringify({
    id: "evt_won",
    type: "charge.dispute.closed",
    data: { object: { payment_intent: "pi_dis", status: "won" } },
  });
  expect((await signedWebhook(t, won)).status).toBe(200);
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: false,
  });

  // A dispute the Seller LOST (closed, status "lost") → access revoked: the funds
  // were pulled back, so the buyer no longer holds the Edition.
  const lost = JSON.stringify({
    id: "evt_lost",
    type: "charge.dispute.closed",
    data: { object: { payment_intent: "pi_dis", status: "lost" } },
  });
  expect((await signedWebhook(t, lost)).status).toBe(200);
  expect(await asUser(t, buyer).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });
});

test("appUrl enforces same-origin — no open redirect off SITE_URL", () => {
  // A same-origin relative path (incl. query) is preserved.
  expect(appUrl("/courses/hindi?lang=es")).toBe("https://app.example.com/courses/hindi?lang=es");
  // Off-origin values (absolute, protocol-relative) are discarded for the root.
  expect(appUrl("//evil.com")).toBe("https://app.example.com/");
  expect(appUrl("https://evil.com/phish")).toBe("https://app.example.com/");
});
