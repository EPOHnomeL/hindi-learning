import { createAuthClient } from "@neondatabase/neon-js/auth";

// Neon Auth client (ADR-0006, the Better Auth-based service). Created only when
// the build carries VITE_NEON_AUTH_URL (set in .env.production); without it —
// local dev — the gate is skipped entirely and the worker falls back to the dev
// user. The URL is the SAME-ORIGIN /api/auth proxy (the worker forwards to the
// real neonauth service) so the session cookie is first-party — browsers drop
// the neonauth domain's cookie as third-party if the SDK calls it directly.
const url = import.meta.env.VITE_NEON_AUTH_URL;

export const authClient = url
  ? createAuthClient(new URL(url, window.location.origin).toString())
  : undefined;
