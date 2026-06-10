# Deploy & go-live runbook

Everything in the app runs locally today; this is the step-by-step to take it live
on Cloudflare with Neon Auth. Steps marked **(you)** create accounts or paste
secrets — they need credentials I don't have. The code seams are already in place
(see `src/worker/auth.ts`, `.mcp.json`, `.env.example`).

> **Status (2026-06-10): LIVE.** Every step below is done. The worker runs at
> **https://hindi-learning.jonathan-603.workers.dev** with auth on (API returns
> 401 without a token), production schema + artifacts published, and the
> deployed origin trusted by Neon Auth. Remaining first-use step: sign in once,
> then create the production Topic row under your real user id (the `dev-user`
> Topic exists only on the dev branch) — see step 9.

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

## 3. R2 bucket ✅ DONE

R2 enabled on the account; the private bucket `served-teach-artifacts` exists
(WEUR). It is bound in `wrangler.toml` and served only through the worker
(never public, ADR-0005).

## 4. Cloudflare login ✅ DONE

`wrangler whoami` → jonathan@y-knot.io, OAuth token with workers write.

## 5. Migrate production ✅ DONE

`pnpm migrate --prod` applied `0001_init.sql` (idempotent, safe to re-run).
The dev branch was also migrated + seeded + published (`pnpm migrate --dev`,
`pnpm seed`, `pnpm run publish`) since it was created before production had
the schema.

## 6. Secrets ✅ DONE

`DATABASE_URL` (production pooled URL, ep-young-bread) and `NEON_AUTH_URL` are
set as worker secrets. Setting `NEON_AUTH_URL` is what turns auth on — the API
now answers 401 to unauthenticated requests.

## 7. Build, deploy, publish ✅ DONE

Deployed to **https://hindi-learning.jonathan-603.workers.dev** and
`pnpm run publish -- --remote` pushed all 4 lessons + 2 references (blobs →
real R2, metadata → production branch). Re-run any of these after changes:

```bash
pnpm build                     # reader SPA → dist/client
pnpm run deploy                # wrangler deploy
pnpm run publish -- --remote   # workspace artifacts → production
```

## 8. Trusted origins ✅ DONE

`https://hindi-learning.jonathan-603.workers.dev` is in Neon Auth's
`trusted_origins` (localhost allowed separately). Add any future custom domain
the same way (Neon console → Auth → Configuration, or the `configure_neon_auth`
MCP tool) — sign-in from an untrusted origin fails.

## 9. First sign-in + verify (you)

- Visit the deployed URL → sign-in gate appears; create an account, land in the reader.
- The production `topics` table is empty: after your first sign-in the reader
  says "No topics yet" until the Topic row is created under your real user id
  (find it in `neon_auth.user`, then insert the `hindi` Topic with that
  `user_id` — ask Claude Code to do it via the Neon MCP).
- Open a lesson, answer a quiz, ask a question, reload → progress dot persists; the answer/question are recorded under your real user.
- `pnpm run review -- --prod` shows the live learner's activity; answer with `pnpm run reply -- --prod <id> "<text>"`.

## Notes

- **Custom domain**: add it in the Cloudflare dashboard (Workers → your worker → Domains) or `wrangler.toml` `routes`. Remember to add it to trusted origins (step 8).
- **Cloudflare Access** was considered (ADR-0004) but we chose Neon Auth for in-app login. If you later want an extra edge gate, add an Access policy in Cloudflare Zero Trust over the worker route — it composes with Neon Auth.
