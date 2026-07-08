import { httpRouter } from "convex/server";
import type Stripe from "stripe";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { constructWebhookEvent } from "./stripe";

// Mounts Convex Auth's HTTP routes (sign-in/up, token refresh, etc.).
const http = httpRouter();
auth.addHttpRoutes(http);

// The Stripe purchase/refund webhook (paid marketplace, ADR 0016). This is the
// ONLY place a purchase grants access — never the client success redirect (which
// can be spoofed). The signature is verified against STRIPE_WEBHOOK_SECRET before
// anything is read; the DB effects live in idempotent internal mutations
// (fulfillPurchase / revokePurchaseByPaymentIntent), so a Stripe re-delivery is a
// safe no-op. This thin action is the untested Stripe boundary (PRD); the tests
// exercise the mutations directly (and reject a bad signature via t.fetch).
//
// For Connect **direct charges**, both the checkout.session.completed and the
// charge.refunded events originate on the Seller's connected account and arrive
// with an `account` field — the metadata/PaymentIntent we set at checkout carry
// what to grant/revoke, so no per-account bookkeeping is needed here.
const stripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await constructWebhookEvent(payload, signature);
  } catch {
    // Bad or forged signature — reject (never process).
    return new Response("invalid signature", { status: 400 });
  }

  try {
    // Grant on a paid Checkout session. `async_payment_succeeded` covers
    // delayed-notification methods (bank debits / some BNPL), whose `completed`
    // event arrives `unpaid` and would otherwise charge the buyer with no access.
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        const topicId = session.metadata?.topicId as Id<"topics"> | undefined;
        const lang = session.metadata?.lang;
        const email = session.customer_details?.email ?? session.customer_email ?? undefined;
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? undefined);
        if (topicId && lang && email) {
          await ctx.runMutation(internal.market.fulfillPurchase, {
            eventId: event.id,
            topicId,
            lang,
            email,
            paymentIntentId,
          });
        }
      }
    } else if (event.type === "charge.refunded" || event.type === "charge.dispute.closed") {
      // DEFENSIVE (the product offers no refunds): revoke access only when money
      // has actually left — a FULL refund, or a chargeback the Seller LOST. A
      // dispute merely being *opened* (`charge.dispute.created`) can still be won,
      // so we wait for `charge.dispute.closed` with `status: "lost"` before
      // revoking. A partial refund (amount_refunded < amount) leaves access intact
      // — a $1 goodwill refund shouldn't strip a paid course.
      const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
      const shouldRevoke =
        event.type === "charge.dispute.closed"
          ? (obj as Stripe.Dispute).status === "lost"
          : "amount_refunded" in obj && obj.amount_refunded >= obj.amount;
      const pi = "payment_intent" in obj ? obj.payment_intent : undefined;
      const paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? undefined);
      if (shouldRevoke && paymentIntentId) {
        await ctx.runMutation(internal.market.revokePurchaseByPaymentIntent, {
          eventId: event.id,
          paymentIntentId,
        });
      }
    }
  } catch {
    // A transient failure — 500 so Stripe retries; idempotency makes retry safe.
    return new Response("processing error", { status: 500 });
  }

  return new Response(null, { status: 200 });
});

http.route({ path: "/stripe/webhook", method: "POST", handler: stripeWebhook });

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
