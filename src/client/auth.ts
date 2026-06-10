import { createAuthClient } from "@neondatabase/neon-js/auth";

// Neon Auth client (ADR-0006, the Better Auth-based service). Created only when
// the build carries VITE_NEON_AUTH_URL (set in .env.production); without it —
// local dev — the gate is skipped entirely and the worker falls back to the dev
// user. The URL is public (it ships to the browser); it is not a secret.
const url = import.meta.env.VITE_NEON_AUTH_URL;

export const authClient = url ? createAuthClient(url) : undefined;
