"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
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
        <h1 className="text-xl font-semibold">{flow === "signIn" ? "Sign in" : "Create account"}</h1>
        <input name="email" type="email" placeholder="Email" autoComplete="email" required className="rounded-lg border border-stone-300 px-3 py-2" />
        <input name="password" type="password" placeholder="Password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required className="rounded-lg border border-stone-300 px-3 py-2" />
        <button type="submit" disabled={busy} className="rounded-lg bg-stone-900 px-3 py-2 font-medium text-white disabled:opacity-50">
          {busy ? "…" : flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          className="text-sm text-stone-500 hover:text-stone-800"
          onClick={() => {
            setError(null);
            setFlow(flow === "signIn" ? "signUp" : "signIn");
          }}
        >
          {flow === "signIn" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
