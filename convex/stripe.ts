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
