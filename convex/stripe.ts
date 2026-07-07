import Stripe from "stripe";

// The Stripe SDK, configured for the Convex runtime — a fetch-based HTTP client
// and Web-Crypto signature verification — so every call runs inside an ordinary
// Convex `action` / HTTP action with no `"use node"`. Stripe SDK calls live ONLY
// in actions (PRD: never in a query or mutation). The secret key is read lazily
// so importing this module never throws when the env var is unset — the test
// suite globs every convex file but no test ever constructs the client.
//
// Provision (test mode) before any Stripe path runs live:
//   STRIPE_SECRET_KEY        — the platform's secret key (sk_test_…)
//   STRIPE_WEBHOOK_SECRET    — the endpoint signing secret (whsec_…, Slice 3)
//   SITE_URL                 — the app origin, for onboarding return/refresh URLs

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set — provision it as a Convex env var");
  // No `apiVersion` pin: the SDK sends its built-in version. The fetch HTTP client
  // is what makes the SDK work in Convex's (non-Node) runtime.
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

// The app origin the Stripe hosted flows return to. Resolved server-side (never a
// client arg) so a caller can't turn onboarding return into an open redirect; the
// client supplies only a relative path, resolved against this trusted base.
export function appUrl(path = "/"): string {
  const base = process.env.SITE_URL;
  if (!base) throw new Error("SITE_URL is not set — provision it as a Convex env var");
  return new URL(path, base).toString();
}

// The platform's take-rate in basis points (the application fee on each sale).
// Config, not architecture (PRD): the owner chose 15% — `PLATFORM_FEE_BPS=1500`.
// Defaults to 1500 so a missing env var doesn't silently zero the platform's cut;
// bounded to [0, 10000] (0–100%) so a stray value can't invert the economics.
export function platformFeeBps(): number {
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? "1500");
  if (!Number.isFinite(raw) || raw < 0 || raw > 10_000) return 1500;
  return Math.round(raw);
}

// The application fee (minor units) for a sale of `amount` minor units.
export function applicationFee(amount: number): number {
  return Math.round((amount * platformFeeBps()) / 10_000);
}

// The Stripe webhook endpoint's signing secret (whsec_…), for signature
// verification in the HTTP action. Read lazily; absent ⇒ every event is rejected.
export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set — provision it as a Convex env var");
  return secret;
}

// Verify a Stripe webhook's signature and parse it — the sole gate on the
// purchase/refund path (access is never granted from the client redirect). Uses
// the async verifier + Web-Crypto provider (the Convex runtime has no Node
// crypto). THROWS on a bad/absent signature, so the HTTP action rejects it.
export async function constructWebhookEvent(payload: string, signature: string): Promise<Stripe.Event> {
  const stripe = stripeClient();
  return await stripe.webhooks.constructEventAsync(
    payload,
    signature,
    webhookSecret(),
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
