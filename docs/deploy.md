# Deploy & go-live runbook

Everything in the app runs locally today; this is the step-by-step to take it live
on Cloudflare with Neon Auth. Steps marked **(you)** create accounts or paste
secrets — they need credentials I don't have. The code seams are already in place
(see `src/worker/auth.ts`, `.mcp.json`, `.env.example`).

> **Status (2026-06-10):** steps 0–2 and 4 are DONE; production schema migration,
> R2 (step 3), and everything after are pending. The two blockers are both yours:
> enable R2 in the Cloudflare dashboard, and approve `pnpm migrate --prod`.

## 0. Connect the MCP servers ✅ DONE

`.mcp.json` declares the Neon and Cloudflare remote MCP servers; both are
authenticated. Neon project: **teacher** (`billowing-voice-30173788`), Cloudflare
account `60350b90af583712edccbf20905459bb`.

## 1. Fix the test branch ✅ DONE

`DATABASE_URL_TEST` now points at the dedicated `test` Neon branch
(`br-polished-mud`, endpoint `ep-orange-frost`); migrations are applied and the
full `pnpm test` suite runs green without touching dev data. Branch map:

| Neon branch  | endpoint        | used by                          |
| ------------ | --------------- | -------------------------------- |
| `production` | ep-young-bread  | `.env` `DATABASE_URL`, deploy    |
| `dev`        | ep-wild-sky     | `.dev.vars` (wrangler dev)       |
| `test`       | ep-orange-frost | `.env` `DATABASE_URL_TEST`       |

## 2. Neon Auth ✅ DONE (code side)

Neon Auth is provisioned on the production branch — and it is the **new Better
Auth-based** service, not the Stack Auth flavor this runbook originally assumed.
There are no `STACK_*` keys; one public URL drives everything:

```
NEON_AUTH_URL = https://ep-young-bread-as4yo5g5.neonauth.c-4.eu-central-1.aws.neon.tech/neondb/auth
JWKS          = <NEON_AUTH_URL>/.well-known/jwks.json
```

Enabled methods: email/password (sign-up open) + shared Google OAuth.

### Worker
`src/worker/auth.ts` verifies the `Authorization: Bearer <jwt>` (EdDSA, issuer =
the auth URL's origin) against the JWKS and returns the user id (`sub`). Setting
the `NEON_AUTH_URL` secret in production turns auth on; unset (local dev) falls
back to the dev user.

### Client
`@neondatabase/neon-js` is installed. `src/client/AuthGate.tsx` gates the reader:
session via SDK cookie, JWT fetched with `authClient.token()` and fed to
`setAuthToken`, refreshed every 10 min and on tab-resume (tokens last 15 min).
The gate only mounts when the build carries `VITE_NEON_AUTH_URL` — committed in
`.env.production`, loaded by `pnpm build` only, so dev stays gate-free.

> The `dev-user` rows seeded locally are a stand-in. In production the first real
> sign-in creates the user; re-`publish` the topic/lessons under that user, or
> migrate the `dev-user` rows to the new id.

## 3. Enable R2 + create the bucket ⚠️ BLOCKED (you, ~1 min)

The account does not have R2 enabled (API returns 403 "Please enable R2 through
the Cloudflare Dashboard"). Dashboard → **R2** → enable (needs a payment method
on file; the free tier covers this app). Then the bucket can be created via MCP
or:

```bash
pnpm exec wrangler r2 bucket create served-teach-artifacts
```

It is bound in `wrangler.toml` and served only through the worker (never public,
ADR-0005). **Deploy is blocked until this exists** — wrangler refuses to deploy
a worker bound to a missing bucket.

## 4. Cloudflare login ✅ DONE

`wrangler whoami` → jonathan@y-knot.io, OAuth token with workers write.

## 5. Migrate production (you — approve it)

The production branch has only the `neon_auth.*` tables; the app schema is not
applied yet. The migration is additive/idempotent (`create table if not exists`):

```bash
pnpm migrate --prod     # applies migrations/0001_init.sql to DATABASE_URL
```

## 6. Secrets (after first deploy or via dashboard)

```bash
pnpm exec wrangler secret put DATABASE_URL    # production Neon pooled URL (ep-young-bread)
pnpm exec wrangler secret put NEON_AUTH_URL   # the auth URL above — turns auth on
```

## 7. Build, deploy, publish

```bash
pnpm build                  # reader SPA → dist/client (already built once, green)
pnpm run deploy             # wrangler deploy
pnpm run publish -- --remote   # push lesson/reference blobs to the real R2 bucket
```

## 8. Trusted origins (after deploy)

Neon Auth's `trusted_origins` list is empty (localhost is allowed separately).
Add the deployed URL (`https://hindi-learning.<subdomain>.workers.dev` and any
custom domain) via the Neon console → Auth → Configuration, or the
`configure_neon_auth` MCP tool — sign-in from the deployed origin fails until
this is set.

## 9. Verify

- Visit the deployed URL → sign-in gate appears; create an account, land in the reader.
- Open a lesson, answer a quiz, ask a question, reload → progress dot persists; the answer/question are recorded under your real user (check `neon_auth.user` for the id).
- `pnpm run review` (with `DATABASE_URL` pointed at production) shows your activity.

## Notes

- **Custom domain**: add it in the Cloudflare dashboard (Workers → your worker → Domains) or `wrangler.toml` `routes`. Remember to add it to trusted origins (step 8).
- **Cloudflare Access** was considered (ADR-0004) but we chose Neon Auth for in-app login. If you later want an extra edge gate, add an Access policy in Cloudflare Zero Trust over the worker route — it composes with Neon Auth.
