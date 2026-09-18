"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { isPostHogInitialized } from "../PostHogClient";
import { readLastAuthMethod, rememberAuthMethod, type AuthMethod } from "./accountLocalState";
import { Logo } from "./Logo";
import { CheckoutSteps } from "./Paygate";
import { useTenant } from "./TenantContext";

// The Password provider's own default rule (`validateDefaultPasswordRequirements`
// in @convex-dev/auth), duplicated here because the unified door has to apply it
// BEFORE it decides what a failure meant. See the submit handler. No account can
// exist with a shorter password: every path that sets one (`signUp`,
// `reset-verification`) runs that same validator server-side.
const MIN_PASSWORD_LENGTH = 8;

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
    <span className="pointer-events-none absolute -end-2 -top-2 whitespace-nowrap rounded-full border border-gold bg-card px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent shadow-sm">
      {label}
    </span>
  );
}

// `embedded` is for a page that has ALREADY introduced itself - `/redeem` shows
// its own brand header and an explanation of what the code does before this
// appears. Rendered whole in there, the screen showed the brand twice with a
// screenful of dead space between them, because this component is otherwise a
// standalone page: it centres itself in the viewport and leads with the logo.
// Embedded, it is just the form card.
export function SignIn({ embedded = false }: { embedded?: boolean } = {}) {
  const { signIn } = useAuthActions();
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const tenant = useTenant();
  // Standing on the checkout URL itself (auth-first, ADR 0021): `AppGate`
  // renders this component *at* `/checkout/<slug>/<lang>` and re-renders into the
  // page after auth, so the path is the buy intent — no marker to carry, and the
  // trigger says what it means. Used only for the checkout rail and its
  // copy now: since 2026-09-18 the form has one door, so there is no opening
  // state to pick.
  const path = usePathname();
  const buyIntent = !!path?.startsWith("/checkout");
  // **One door** (2026-09-18). There is no sign-in/sign-up toggle any more: the
  // submit button tries `signIn` and, only if that fails, `signUp`, so a visitor
  // never has to know which of the two they are. A new address is registered, a
  // known one is signed in, and the opening-state guessing this used to do for
  // `/checkout`, `/redeem` and `/sign-up` is gone with it.
  //
  // `reset` and `reset-verification` are the two halves of the forgot-password
  // walk (technical-foundation ticket 21), and they are named for the `flow` param
  // Convex Auth's Password provider expects, because that is exactly what this
  // value is posted as. Neither is ever an opening state: you can only arrive at
  // them from the form.
  const [flow, setFlow] = useState<"auth" | "reset" | "reset-verification">("auth");
  const isReset = flow === "reset" || flow === "reset-verification";
  // The address the code was sent to, held across the step change: the second step
  // asks only for the code and the new password, but the provider verifies the OTP
  // against the address it was issued for, so it has to be posted again. Carried in
  // state rather than a visible field so it cannot be edited between the steps into
  // something the code was never minted for.
  const [resetEmail, setResetEmail] = useState("");
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
    // `svh`, not `vh`: on a phone `100vh` is the viewport with the browser chrome
    // discounted, so a screen that exactly fits gains a scrollbar and a rubber-band
    // jog as the URL bar hides. `svh` is the small viewport — the one that's always
    // visible. Vertical padding as well as horizontal, because this centres a card
    // taller than a small phone, and without it the logo is clipped at the top
    // rather than scrolled to. `gap-5` on a phone: `gap-6` between four stacked
    // blocks is most of a thumb's worth of scrolling for nothing.
    <div className={embedded ? "w-full" : "grid min-h-svh place-items-center px-4 py-8"}>
      <div className={`flex w-full flex-col items-center gap-5 sm:gap-6 ${embedded ? "" : "max-w-sm"}`}>
        {!embedded && (
        <div className="flex flex-col items-center gap-2 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, not a static asset.
            <img src={tenant.logoUrl} alt={tenant.displayName} className="h-14 w-auto max-w-[min(16rem,100%)] object-contain sm:h-16" />
          ) : (
            <Logo className="h-11 w-11 text-accent" />
          )}
          <div>
            <h1 className="text-balance text-xl font-semibold tracking-tight text-accent sm:text-2xl">{tenant?.displayName ?? "My Course"}</h1>
            {(tenant ? tenant.motto : tc("tagline")) && (
              <p className="mt-0.5 text-sm text-soft">{tenant ? tenant.motto : tc("tagline")}</p>
            )}
          </div>
        </div>
        )}
        {/* Arrived mid-purchase: show the same four-step rail the checkout page
            shows, so the account step reads as one step of a purchase rather
            than an unexplained wall in front of it. Only on a checkout path —
            a plain sign-in is not a checkout. */}
        {buyIntent && (
          // `px-2` on a phone: the rail is the widest thing on this screen and
          // its own box was eating 32px of the 320px it has to fit inside.
          <div className="w-full rounded-xl border border-line bg-card px-2 py-3 sm:px-4">
            {/* Always step 1 by construction: AppGate renders SignIn only to
                unauthenticated visitors, so there is nothing to derive here. */}
            <CheckoutSteps current={1} />
          </div>
        )}
        {/* **The Organisation Voucher door**, above the form rather than below it and a
            line rather than a button (2026-08-25). A Seat has no email and no password,
            so every field below is useless to one: a member who signs out, or whose
            session finally expires, would otherwise meet a wall with nothing on it for
            them. Above, because it has to be read BEFORE somebody starts typing into
            fields that cannot work for them.

            Not shown on `/join` itself, where it would point at the page they are
            standing on. Kept separate from the voucher prompt below: a Bulk Voucher is
            redeemed ONTO an account, an Organisation Voucher IS the account, and one
            line covering both would leave a member guessing which page their code
            belongs to. */}
        {!embedded && !path?.startsWith("/join") && (
          <p className="w-full text-center text-sm text-soft">
            {t.rich("joinPrompt", {
              join: (c) => (
                <Link href="/join" className="text-accent2 underline-offset-2 hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        )}
        <form
          className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const formData = new FormData(e.currentTarget);
            if (isPostHogInitialized()) posthog.capture("auth_password_submitted", { flow, checkout_intent: buyIntent });
            // **Step one of a reset tells the visitor nothing.** Convex Auth
            // throws `InvalidAccountId` when the address has no account, so
            // reporting the outcome here would turn this form into an oracle for
            // which of your users' addresses are registered. The failure is
            // swallowed and the code step is shown either way; the copy on it
            // promises only "if that address has an account".
            if (flow === "reset") {
              formData.set("flow", "reset");
              try {
                await signIn("password", formData);
              } catch {
                // Deliberately ignored. See above.
              }
              setResetEmail(String(formData.get("email") ?? ""));
              setFlow("reset-verification");
              setBusy(false);
              return;
            }
            if (flow === "reset-verification") {
              formData.set("flow", "reset-verification");
              formData.set("email", resetEmail);
              try {
                await signIn("password", formData);
                // A completed reset counts as a password sign-in: the provider signs
                // the user in as part of verifying the code, and password is how
                // they got back.
                rememberAuthMethod("password");
              } catch {
                setError(t("resetFailed"));
                setBusy(false);
              }
              return;
            }

            // **The one door.** `signIn` first and `signUp` only as a fallback,
            // never the other way round: sign-up-first would be attempted on every
            // returning visitor, and a provider change that ever made
            // `createAccount` link rather than throw would then silently repoint an
            // existing account. Signing in first can only ever succeed for somebody
            // who already holds the credential.
            const email = String(formData.get("email") ?? "");
            const password = String(formData.get("password") ?? "");
            // Checked here, before either attempt, because it is what makes the
            // fallback below readable: with a long-enough password the only
            // ordinary reason `signUp` ALSO fails is that the address is already
            // taken, so that pair of failures means "wrong password". Left to the
            // server, a too-short password would fail both attempts and be reported
            // as a wrong one.
            if (password.length < MIN_PASSWORD_LENGTH) {
              setError(t("passwordTooShort"));
              setBusy(false);
              return;
            }
            let created = false;
            try {
              await signIn("password", { email, password, flow: "signIn" });
            } catch {
              try {
                await signIn("password", { email, password, flow: "signUp" });
                created = true;
              } catch {
                // Both halves refused: the address is registered and the password
                // does not match it. (`signUp` throws on an address that already has
                // an account, and the length rule above has ruled out the other
                // everyday cause.)
                setError(t("wrongPassword"));
                setBusy(false);
                return;
              }
            }
            // Only on success, and only after it. A failed attempt shouldn't
            // rewrite the hint. A sign-*up* counts too: it's how they'll come back.
            rememberAuthMethod("password");
            // Which half of the door they went through is the thing worth counting
            // now that the visitor no longer declares it: this is the new-versus-
            // returning split for every funnel that starts here.
            if (isPostHogInitialized()) posthog.capture("auth_password_succeeded", { created, checkout_intent: buyIntent });
          }}
        >
          <h2 className="text-xl font-semibold text-accent">
            {isReset ? t("resetTitle") : t("continueTitle")}
          </h2>
          {/* The lead is doing the work the toggle used to: it says, in words,
              that one button covers both arrivals, so nobody hunts for a "create
              account" link that is no longer there. */}
          {!isReset && (
            <p className="-mt-1.5 text-sm text-soft">{buyIntent ? t("buyIntent") : t("continueLead")}</p>
          )}
          {/* On step two this is the only acknowledgement the request was made,
              and it is deliberately conditional ("if that address has an
              account"): a definite "we sent it" would leak the same fact the
              swallowed error above is protecting. */}
          {isReset && (
            <p className="-mt-1.5 text-sm text-soft">{flow === "reset" ? t("resetLead") : t("resetSent")}</p>
          )}
          {/* With email-linking (#111) a Google click signs in and signs up
              identically, which is the same promise the password button below now
              makes. Hidden mid-reset: someone who is here because their password does not
              work is not helped by a second way in, and a Google click would
              abandon the code already sitting in their inbox. */}
          {!isReset && (
          <>
          <button
            type="button"
            disabled={busy}
            className="relative flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 font-medium text-accent hover:border-gold disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                if (isPostHogInitialized()) posthog.capture("auth_google_started", { checkout_intent: buyIntent });
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
                // preserving the `/checkout/<slug>/<lang>` path they were buying
                // from. Validated server-side by `oauthRedirectUrl`, which checks
                // the HOST only and never inspects the path.
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
          </>
          )}
          {flow !== "reset-verification" && (
          <input name="email" type="email" placeholder={t("email")} autoComplete="email" required className="rounded-lg border border-line bg-card px-3 py-2.5 focus:border-gold focus:outline-none" />
          )}
          {!isReset && (
          // `current-password`, not `new-password`, even though this same field
          // creates the account for a first-time visitor: the form cannot know
          // which of the two it is facing, and `current-password` is the value that
          // lets a returning visitor's password manager fill it. A browser still
          // offers to SAVE whatever a new visitor types. `minLength` mirrors the
          // provider's own rule so the browser can say so without a round-trip.
          <input name="password" type="password" placeholder={t("password")} autoComplete="current-password" minLength={MIN_PASSWORD_LENGTH} required className="rounded-lg border border-line bg-card px-3 py-2.5 focus:border-gold focus:outline-none" />
          )}
          {/* The door out of the lockout. Shown on the one door, because the form
              cannot know whether this visitor has a password to have forgotten;
              hidden mid-reset, where it would point at the step you are standing
              on. A quiet end-aligned line rather than a button, so it does not
              compete with the two real ways in. */}
          {!isReset && (
            <button
              type="button"
              className="-mt-1 self-end text-sm text-soft hover:text-accent"
              onClick={() => {
                setError(null);
                setFlow("reset");
              }}
            >
              {t("forgotPassword")}
            </button>
          )}
          {flow === "reset-verification" && (
            <>
              {/* `inputMode` and the digit pattern, not `type="number"`: a numeric
                  keypad on a phone without the spinner, the scroll-wheel edits or
                  the silent value loss a number input brings. `one-time-code` is
                  what lets iOS and Android offer the code straight off the
                  notification. */}
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                required
                placeholder={t("resetCode")}
                className="rounded-lg border border-line bg-card px-3 py-2.5 tracking-[0.3em] focus:border-gold focus:outline-none"
              />
              {/* `newPassword`, not `password`: it is the param name the Password
                  provider reads for the `reset-verification` flow. */}
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                placeholder={t("newPassword")}
                className="rounded-lg border border-line bg-card px-3 py-2.5 focus:border-gold focus:outline-none"
              />
            </>
          )}
          <button type="submit" disabled={busy} className="relative rounded-lg bg-accent px-3 py-2.5 font-medium text-white disabled:opacity-50">
            {busy
              ? "…"
              : flow === "auth"
                ? t("continueAction")
                : flow === "reset"
                  ? t("sendResetCode")
                  : t("setNewPassword")}
            {/* Not during the reset walk, where "Last used" would be advising on a
                button that is neither of the two ways in. */}
            {!busy && flow === "auth" && lastUsed === "password" && <LastUsedPill label={t("lastUsed")} />}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
          {/* The way out of the reset detour, and the only navigation this card has
              left: with one door there is nothing to toggle between. */}
          {isReset && (
            <button
              type="button"
              className="py-1 text-sm text-soft hover:text-accent"
              onClick={() => {
                setError(null);
                setFlow("auth");
              }}
            >
              {t("backToSignIn")}
            </button>
          )}
          {/* In front of every visitor who presses the button, not just a declared
              sign-up: pressing it may be what creates the account. */}
          {!isReset && (
            <p className="text-center text-xs text-soft">
              {t.rich("termsAgreement", {
                terms: (c) => <Link href="/terms" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
                privacy: (c) => <Link href="/privacy" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
              })}
            </p>
          )}
        </form>
        {/* Somebody holding a voucher code who arrived at the front door rather
            than following their organisation's link has, until now, had no way to
            find `/redeem` at all - the platform never mentions it anywhere else.
            Not shown on `/redeem` itself, where it would point at the page they
            are standing on. */}
        {!embedded && !path?.startsWith("/redeem") && (
          <p className="text-center text-sm text-soft">
            {t.rich("voucherPrompt", {
              redeem: (c) => (
                <Link href="/redeem" className="text-accent2 underline-offset-2 hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
