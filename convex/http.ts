import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { acceptNotification, pfParamString, validateUrl, verifySignature } from "./payfast";

// Mounts Convex Auth's HTTP routes (sign-in/up, token refresh, etc.).
const http = httpRouter();
auth.addHttpRoutes(http);

// The PayFast ITN — the server-to-server payment notification and the ONLY
// place a purchase grants access (never the client return redirect, which can
// be spoofed). Three verification steps before anything is trusted
// (.scratch/payfast-payments):
//   1. the inline-MD5 signature over the fields in RECEIVED order + passphrase;
//   2. the amount against the CHECKOUT-INTENT's price — what was listed when
//      the buyer clicked Buy (a tampered/cheap payment never unlocks a dearer
//      Edition, and a re-price/un-list after Buy never strands a genuine
//      payment: once they've paid what was asked, they own it);
//   3. a server postback to PayFast's /eng/query/validate that must say VALID —
//      which also subsumes the source-IP allowlist check we deliberately skip
//      (serverless egress IPs are unreliable to pin).
// What to grant (topic/lang) and to whom (the buyer's ACCOUNT email, frozen
// into the intent at Buy — auth-first, ADR 0021) comes from the intent, our own
// record — not from the notification's echoed fields. The DB effects live in the
// idempotent fulfillPurchase (keyed on pf_payment_id), so a PayFast re-delivery
// is a safe no-op.
//
// This handler is an ADAPTER (architecture-deepening/04): it owns only the HTTP
// shape (parse the body, look the intent up, map a verdict to a status code) and
// the network hop. Step 2 — the acceptance rules themselves — lives in
// `payfast.acceptNotification`, unit-tested without a mock.
const payfastNotify = httpAction(async (ctx, request) => {
  const raw = await request.text();
  // URLSearchParams preserves the received order — the signature depends on it.
  const fields: Record<string, string> = {};
  for (const [k, val] of new URLSearchParams(raw)) fields[k] = val;

  const passphrase = process.env.PAYFAST_PASSPHRASE;
  // Misconfiguration is a 500 (PayFast retries until it's fixed), never a 400
  // (which would permanently drop a genuine payment).
  if (!passphrase) return new Response("PAYFAST_PASSPHRASE is not set", { status: 500 });
  if (!verifySignature(fields, passphrase)) return new Response("invalid signature", { status: 400 });

  // Resolve the Buy click this payment answers (`m_payment_id` is our
  // checkout-intent reference), then let the acceptance rules decide. Both happen
  // before the network hop — cheap rejections first.
  const intent = await ctx.runQuery(internal.market.checkoutIntentByRef, {
    mPaymentId: fields.m_payment_id ?? "",
  });
  const acceptance = acceptNotification(fields, intent);
  // `ignore` is a genuine notification with nothing to do (CANCELLED etc.):
  // acknowledge it so PayFast stops re-sending. `refuse` must never grant.
  if (acceptance.outcome === "ignore") return new Response(null, { status: 200 });
  if (acceptance.outcome === "refuse") return new Response(acceptance.reason, { status: 400 });
  // The verdict carries the intent it accepted against — what to grant, and to whom.
  const { payment: { pfPaymentId, gross, fee, net }, intent: accepted } = acceptance;

  // Server postback: PayFast must confirm it really sent this notification.
  // The body is the received fields minus the signature, order preserved.
  let confirmed = false;
  try {
    const res = await fetch(validateUrl(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: pfParamString(fields),
    });
    confirmed = res.ok && (await res.text()).trim().startsWith("VALID");
  } catch {
    confirmed = false;
  }
  if (!confirmed) return new Response("validation failed", { status: 400 });

  try {
    await ctx.runMutation(internal.market.fulfillPurchase, {
      pfPaymentId,
      topicId: accepted.topicId,
      lang: accepted.lang,
      email: accepted.email,
      gross,
      fee,
      net,
    });
  } catch {
    // A transient failure — 500 so PayFast retries; idempotency makes it safe.
    return new Response("processing error", { status: 500 });
  }
  return new Response(null, { status: 200 });
});

http.route({ path: "/payfast/notify", method: "POST", handler: payfastNotify });

// Serve a **content blob** (a Lesson / Reference / translated body, see
// .scratch/html-blob-storage) by its storageId. The storageId is an unguessable
// bearer capability minted into the URL only for callers a reader query has
// already authorized — this route does no per-request auth (matching the
// existing `resources` / `emblem` bearer URLs), which is what lets the response
// be cached hard. Content is immutable per storageId, so we serve it `immutable`
// with a one-year max-age; a superseding body gets a new storageId → new URL.
http.route({
  path: "/content",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    let blob: Blob | null = null;
    try {
      if (id) blob = await ctx.storage.get(id as Id<"_storage">);
    } catch {
      blob = null; // malformed id → treat as missing
    }
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        // Bearer capability, not user-scoped — safe to serve to any origin, and
        // the reader `fetch`es it cross-origin from the web app.
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
