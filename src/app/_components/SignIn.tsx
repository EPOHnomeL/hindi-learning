"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readLastAuthMethod, rememberAuthMethod, type AuthMethod } from "./accountLocalState";
import { useBuyMarker } from "./editionUrl";
import { Logo } from "./Logo";
import { useTenant } from "./TenantContext";

// Google's four-colour G. Inline rather than an asset: it must render before any
// network fetch on the sign-in screen, and Google's brand guidelines require the
// official mark be used unaltered — so the paths are fixed, not themed.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.6h11.9c-.2 2-1.5 5-4.4 7l6.7 5.2c4-3.7 6.9-9.1 6.9-15.8z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.8-3.8-12.6-9.1l-7.1 5.5C7.9 41.2 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.4 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.7-4.5l-7.1-5.5C2.8 17 2 20.4 2 24s.8 7 2.2 10l7.2-5.5z" />
      <path fill="#EA4335" d="M24 10.8c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.6 29.9 2 24 2 15.4 2 7.9 6.8 4.2 14l7.1 5.5c1.9-5.3 6.9-8.7 12.7-8.7z" />
    </svg>
  );
}

// The "Last used" marker: a little banner pinned over the top-right corner of the
// method it describes, rather than a word inside the label — the button's own text
// stays the thing you read, and the hint sits beside it instead of lengthening it.
//
// Carries its own `bg-card` + gold outline so it reads identically on both hosts,
// which are opposite surfaces: the Google button is the card itself, the submit
// button a solid accent fill. A tinted-transparent chip would need a different
// colour on each; an opaque one needs none.
//
// The host button must be `relative`. `pointer-events-none` so the banner is never
// a dead spot on the button it overhangs.
function LastUsedPill({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -right-2 -top-2 whitespace-nowrap rounded-full border border-gold bg-card px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent shadow-sm">
      {label}
    </span>
  );
}

export function SignIn() {
  const { signIn } = useAuthActions();
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const tenant = useTenant();
  // Arriving via a share reader's Buy CTA (`buy=1`, auth-first checkout): the
  // common path is a NEW buyer, so the form opens on "Create account" with
  // purchase-flavoured copy; the toggle still reaches sign-in. Without the
  // marker the default stays "Sign in".
  const buyIntent = useBuyMarker();
  const [flow, setFlow] = useState<"signIn" | "signUp">(buyIntent ? "signUp" : "signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Read in an effect, not during render: localStorage doesn't exist on the server,
  // so reading it inline would render no pill server-side and a pill on the client
  // — a hydration mismatch. The pill therefore appears one paint late, which is
  // invisible next to the OAuth round-trip it's advising on. Same mount-gating the
  // Landing's DemoCertificate uses for its locale-dependent dates.
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);
  useEffect(() => setLastUsed(readLastAuthMethod()), []);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, not a static asset.
            <img src={tenant.logoUrl} alt={tenant.displayName} className="h-16 w-auto max-w-64 object-contain" />
          ) : (
            <Logo className="h-11 w-11 text-accent" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-accent">{tenant?.displayName ?? "My Course"}</h1>
            {(tenant ? tenant.motto : tc("tagline")) && (
              <p className="mt-0.5 text-sm text-soft">{tenant ? tenant.motto : tc("tagline")}</p>
            )}
          </div>
        </div>
        <form
          className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-card p-6 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const formData = new FormData(e.currentTarget);
            formData.set("flow", flow);
            try {
              await signIn("password", formData);
              // Only on success, and only after it — a failed attempt shouldn't
              // rewrite the hint. A sign-*up* counts too: it's how they'll come back.
              rememberAuthMethod("password");
            } catch {
              setError(flow === "signIn" ? t("signInFailed") : t("signUpFailed"));
              setBusy(false);
            }
          }}
        >
          <h2 className="text-xl font-semibold text-accent">{flow === "signIn" ? t("signIn") : t("createAccount")}</h2>
          {buyIntent && flow === "signUp" && (
            <p className="-mt-1.5 text-sm text-soft">{t("buyIntent")}</p>
          )}
          {/* Shown in both toggle states: with email-linking (#111) a Google click
              signs in and signs up identically, so there is nothing to choose. */}
          <button
            type="button"
            disabled={busy}
            className="relative flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 py-2 font-medium text-accent hover:border-gold disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                // Written *before* the call, unlike the password path: `signIn`
                // hands the browser to Google, so nothing after the await is
                // guaranteed to run. The cost of being early is a stale hint if the
                // reader abandons Google's consent screen — they'd be nudged at a
                // button they didn't finish with, which is nearly free to ignore.
                rememberAuthMethod("google");
                // `redirectTo` is required, not optional polish: with it omitted the
                // OAuth callback falls back to SITE_URL — the apex — and under ADR
                // 0025's host-only session cookie the buyer would come back signed
                // in on the apex and still signed out on the tenant subdomain they
                // started from. Sending the current href returns them to this host,
                // preserving `buy=1` and any course path. Validated server-side by
                // `oauthRedirectUrl`.
                await signIn("google", { redirectTo: window.location.href });
              } catch {
                setError(t("googleFailed"));
                setBusy(false);
              }
            }}
          >
            <GoogleMark />
            {t("continueWithGoogle")}
            {lastUsed === "google" && <LastUsedPill label={t("lastUsed")} />}
          </button>
          <div className="flex items-center gap-3 text-xs text-soft">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>
          <input name="email" type="email" placeholder={t("email")} autoComplete="email" required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <input name="password" type="password" placeholder={t("password")} autoComplete={flow === "signIn" ? "current-password" : "new-password"} required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <button type="submit" disabled={busy} className="relative rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-50">
            {busy ? "…" : flow === "signIn" ? t("signIn") : t("signUp")}
            {/* Only while signing in: on the "Create account" toggle a "Last used"
                banner would be nonsense — you can't have last created this account. */}
            {!busy && flow === "signIn" && lastUsed === "password" && <LastUsedPill label={t("lastUsed")} />}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            className="text-sm text-soft hover:text-accent"
            onClick={() => {
              setError(null);
              setFlow(flow === "signIn" ? "signUp" : "signIn");
            }}
          >
            {flow === "signIn" ? t("toggleToSignUp") : t("toggleToSignIn")}
          </button>
          {flow === "signUp" && (
            <p className="text-center text-xs text-soft">
              {t.rich("termsAgreement", {
                terms: (c) => <Link href="/terms" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
                privacy: (c) => <Link href="/privacy" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
              })}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
