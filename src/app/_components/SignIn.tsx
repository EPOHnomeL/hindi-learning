"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Logo } from "./Logo";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Post-payment return (paid marketplace, .scratch/payfast-payments): PayFast
  // sends the buyer back to /courses/[slug]?purchase=return&mp=<intent token>,
  // and this gate renders at that URL while signed out. The checkout-intent
  // resolves the PAID email, which is prefilled and LOCKED into the form so the
  // buyer can't create a mismatched account that fails to claim their purchase.
  // The query is reactive: if the ITN hasn't landed yet, the page shows a
  // pending state and flips to the sign-up form the moment it does.
  const params = useSearchParams();
  const mp = params.get("mp");
  const checkout = useQuery(api.market.checkoutStatus, mp ? { mPaymentId: mp } : "skip");
  const lockedEmail = checkout?.email ?? null;
  // A paid-but-unclaimed purchase means the buyer needs an ACCOUNT — steer the
  // form to sign-up; a granted one means the account exists — steer to sign-in.
  useEffect(() => {
    if (checkout?.state === "paid-awaiting-signup") setFlow("signUp");
    if (checkout?.state === "granted") setFlow("signIn");
  }, [checkout?.state]);

  const awaitingPayment = checkout?.state === "awaiting-payment";

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="h-11 w-11 text-accent" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-accent">My Course</h1>
            <p className="mt-0.5 text-sm text-soft">Your learning workspace</p>
          </div>
        </div>
        {checkout && (
          <div className="w-full rounded-2xl border border-gold/40 bg-card p-4 text-sm leading-relaxed text-soft shadow-sm">
            {awaitingPayment ? (
              <span aria-busy>
                <b className="font-semibold text-ink">Confirming your payment…</b> This usually takes a few seconds —
                the form will open as soon as PayFast confirms.
              </span>
            ) : checkout.state === "paid-awaiting-signup" ? (
              <span>
                <b className="font-semibold text-ink">Payment received.</b> Create your account below to open your
                course — it&rsquo;s attached to the email you paid with.
              </span>
            ) : (
              <span>
                <b className="font-semibold text-ink">Payment received.</b> Sign in below to open your course.
              </span>
            )}
          </div>
        )}
        <form
          className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-card p-6 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const formData = new FormData(e.currentTarget);
            formData.set("flow", flow);
            // The paid email always wins — a read-only input is a UI courtesy,
            // this is the actual value submitted.
            if (lockedEmail) formData.set("email", lockedEmail);
            try {
              await signIn("password", formData);
            } catch {
              setError(flow === "signIn" ? "Sign-in failed. Check your email and password." : "Sign-up failed. Try a different email or a stronger password.");
              setBusy(false);
            }
          }}
        >
          <h2 className="text-xl font-semibold text-accent">{flow === "signIn" ? "Sign in" : "Create account"}</h2>
          <input
            // Remount when the paid email resolves — the input flips from a free
            // uncontrolled field to a locked controlled one.
            key={lockedEmail ? "locked" : "free"}
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            readOnly={!!lockedEmail}
            {...(lockedEmail ? { value: lockedEmail } : {})}
            className={`rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none ${lockedEmail ? "cursor-not-allowed opacity-70" : ""}`}
          />
          {lockedEmail && (
            <p className="-mt-1.5 text-xs text-soft">Fixed to the email you paid with, so your purchase attaches to this account.</p>
          )}
          <input name="password" type="password" placeholder="Password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <button type="submit" disabled={busy || awaitingPayment} className="rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-50">
            {busy ? "…" : flow === "signIn" ? "Sign in" : "Sign up"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            className="text-sm text-soft hover:text-accent"
            onClick={() => {
              setError(null);
              setFlow(flow === "signIn" ? "signUp" : "signIn");
            }}
          >
            {flow === "signIn" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
