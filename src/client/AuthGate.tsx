import { useCallback, useEffect, useState, type ReactNode } from "react";
import { setAuthToken } from "./api";
import { authClient } from "./auth";

// Gates the reader behind Neon Auth (ADR-0006). When the build has no
// VITE_NEON_AUTH_URL (local dev) the gate renders children immediately and the
// worker falls back to the dev user. When configured, the session lives in a
// cookie managed by the SDK; the worker, however, verifies a JWT, so on sign-in
// we fetch one via authClient.token() and feed it to the API client — and keep
// refreshing it, since Neon Auth access tokens expire after 15 minutes.
const TOKEN_REFRESH_MS = 10 * 60 * 1000;

type Phase = "loading" | "signed-out" | "ready";

export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(authClient ? "loading" : "ready");

  const refreshToken = useCallback(async () => {
    if (!authClient) return false;
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      setAuthToken(undefined);
      return false;
    }
    setAuthToken(data.token);
    return true;
  }, []);

  // Initial session check: an existing cookie session goes straight through.
  useEffect(() => {
    if (!authClient) return;
    void authClient.getSession().then(async (result) => {
      if (result.data?.session && (await refreshToken())) setPhase("ready");
      else setPhase("signed-out");
    });
  }, [refreshToken]);

  // Keep the short-lived JWT fresh while reading — periodically and whenever
  // the tab comes back to the foreground (mobile resume).
  useEffect(() => {
    if (phase !== "ready" || !authClient) return;
    const interval = setInterval(() => void refreshToken(), TOKEN_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshToken();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, refreshToken]);

  if (phase === "loading") return <div className="center muted">Checking session…</div>;
  if (phase === "signed-out") {
    return <SignInForm onSignedIn={async () => setPhase((await refreshToken()) ? "ready" : "signed-out")} />;
  }
  return <>{children}</>;
}

function SignInForm({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: email.split("@")[0] || "Learner", email, password })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      setBusy(false);
      return;
    }
    await onSignedIn();
  };

  return (
    <div className="center">
      <form className="authgate" onSubmit={submit}>
        <h1>{mode === "sign-in" ? "Sign in" : "Create account"}</h1>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted small">
          {mode === "sign-in" ? "No account yet?" : "Already have an account?"}{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setError(null);
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            }}
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </a>
        </p>
      </form>
    </div>
  );
}
