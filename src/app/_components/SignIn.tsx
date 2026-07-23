"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useBuyMarker } from "./editionUrl";
import { Logo } from "./Logo";
import { useTenant } from "./TenantContext";

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
          <input name="email" type="email" placeholder={t("email")} autoComplete="email" required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <input name="password" type="password" placeholder={t("password")} autoComplete={flow === "signIn" ? "current-password" : "new-password"} required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-50">
            {busy ? "…" : flow === "signIn" ? t("signIn") : t("signUp")}
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
