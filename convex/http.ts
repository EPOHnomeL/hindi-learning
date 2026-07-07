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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // Only grant on a genuinely paid session.
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
    } else if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      // DEFENSIVE (the product offers no refunds): if Stripe ever reports a refund
      // or chargeback, revoke the matching purchase by its PaymentIntent id.
      const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
      const pi = "payment_intent" in obj ? obj.payment_intent : undefined;
      const paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? undefined);
      if (paymentIntentId) {
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

export default http;
