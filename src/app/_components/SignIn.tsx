"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Logo } from "./Logo";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
              setError(flow === "signIn" ? "Sign-in failed. Check your email and password." : "Sign-up failed. Try a different email or a stronger password.");
              setBusy(false);
            }
          }}
        >
          <h2 className="text-xl font-semibold text-accent">{flow === "signIn" ? "Sign in" : "Create account"}</h2>
          <input name="email" type="email" placeholder="Email" autoComplete="email" required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <input name="password" type="password" placeholder="Password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required className="rounded-lg border border-line bg-card px-3 py-2 focus:border-gold focus:outline-none" />
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-50">
            {busy ? "…" : flow === "signIn" ? "Sign in" : "Sign up"}
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
            {flow === "signIn" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
