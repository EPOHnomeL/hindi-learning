# Neon Auth for in-app authentication (supersedes ADR-0004)

> **Amendment (2026-06-10):** Neon Auth is now built on **Better Auth**, not Stack
> Auth. There are no Stack keys; the only configuration is the public per-branch
> auth base URL (`NEON_AUTH_URL` for the worker, `VITE_NEON_AUTH_URL` for the
> browser build). The worker verifies EdDSA JWTs against
> `<auth-url>/.well-known/jwks.json` (issuer = the URL's origin); the client is
> `@neondatabase/neon-js`. Users sync into `neon_auth.user` (not `users_sync`).
> The decision itself — in-app auth via Neon Auth, no custom domain — stands.

We authenticate with **Neon Auth** (Neon's managed auth, built on Stack Auth) rather than Cloudflare Access. Auth is in-app: real sign-in, and user records sync into our Neon Postgres (`neon_auth.users_sync`). This makes the `user_id` scoping carried throughout the schema *real* (it references actual users), supports the multi-user "teach me anything / accounts" direction from day one, and — because auth lives in the app, not at the edge — needs **no custom domain**: v1 ships on the free `*.workers.dev` URL with working login.

This reverses ADR-0004 (Cloudflare Access). Access was the right call *when* the goal was zero auth code for a single user, but it gates the whole app to fixed emails and requires a Cloudflare-hosted custom domain. Since the project always intended multiple accounts eventually, doing in-app auth now avoids a forced migration later.

## Considered Options

- **Cloudflare Access** (ADR-0004) — zero app code, but single-identity gate, needs a custom domain, and is a dead end for multi-user.
- **Chosen: Neon Auth** — some auth wiring now (sign-in UI + verifying the session in the Hono worker), but real accounts in the DB, no domain required, and a direct path to multi-user.

## Consequences

- The worker must verify the Neon Auth session/JWT on protected routes; the frontend gets a sign-in flow. This is the auth code ADR-0004 avoided — accepted deliberately.
- `user_id` becomes a real user identity from Neon Auth, not a placeholder string.
- No custom domain needed to ship; a domain becomes optional/cosmetic later.
- Neon Auth keys (publishable client key, secret server key) live in `.env` / `.dev.vars` / Wrangler secrets — never committed.
