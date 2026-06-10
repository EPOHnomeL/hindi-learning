# Deploy & go-live runbook

Everything in the app runs locally today; this is the step-by-step to take it live
on Cloudflare with Neon Auth. Steps marked **(you)** create accounts or paste
secrets — they need credentials I don't have. The code seams are already in place
(see `src/worker/auth.ts`, `.mcp.json`, `.env.example`).

## 0. Connect the MCP servers (`.mcp.json` is committed)

`.mcp.json` declares the Neon and Cloudflare remote MCP servers. In Claude Code,
run `/mcp` and authenticate each via OAuth (a browser window opens):

- **neon** → `https://mcp.neon.tech/mcp` — manage the Hub (branches, SQL).
- **cloudflare-bindings** / **cloudflare-observability** — manage Workers/R2 and read logs.

Once connected I can do most of steps 1–6 for you through the MCPs instead of you
running CLI commands by hand.

## 1. Fix the test branch ⚠️ (you, ~2 min — do this first)

Today `DATABASE_URL_TEST` (in `.env`) points at the **same** Neon branch the dev
worker uses (`.dev.vars` `DATABASE_URL`). The Neon contract tests truncate tables,
so `pnpm test` **wipes dev data**. Create a dedicated test branch and point the
tests at it:

1. Neon console → your project → Branches → **Create branch** (e.g. `test`).
2. Copy its pooled connection string into `.env` as `DATABASE_URL_TEST=...`.
3. `pnpm migrate` against it once (set `DATABASE_URL` to the test branch for that run, or add a `migrate:test`).

After this, `pnpm test` is safe.

## 2. Neon Auth (in-app login — ADR-0006)

### a. Enable it (you)
Neon console → your project → **Auth** → enable Neon Auth. Copy:
- Project ID → `VITE_STACK_PROJECT_ID` and worker `STACK_PROJECT_ID`
- Publishable client key → `VITE_STACK_PUBLISHABLE_CLIENT_KEY`
- Secret server key → `STACK_SECRET_SERVER_KEY`

Put the `VITE_*` values in `.env` (build-time, browser-exposed) and the worker
values as Wrangler secrets (step 5).

### b. Worker (already wired)
`src/worker/auth.ts` verifies the `Authorization: Bearer <jwt>` against the Stack
JWKS and returns the user id; the middleware in `index.ts` sets it on the request,
falling back to a dev user only when `STACK_PROJECT_ID` is unset. Setting
`STACK_PROJECT_ID` in production turns auth on — no code change.

### c. Client (one wiring step)
The reader already sends the token (`setAuthToken` in `src/client/api.ts`); it just
needs the Stack provider to supply it:

```bash
pnpm add @stackframe/react
```

Wrap the app and feed the access token to the API client (confirm the exact hook
names against current Neon Auth docs — the shape is stable, names may differ):

```tsx
// src/client/main.tsx
import { StackProvider, StackClientApp } from "@stackframe/react";

const stack = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie",
});

// In a small component mounted inside <StackProvider app={stack}>:
//   const user = useUser({ or: "redirect" });        // gates the app to signed-in users
//   useEffect(() => { user?.getAuthJson().then(j => setAuthToken(j?.accessToken)); }, [user]);
```

Once `setAuthToken` carries a real token, the worker resolves the real Neon Auth
user instead of `dev-user`, and Progress/Responses/Questions are scoped to them.

> The `dev-user` rows seeded locally are a stand-in. In production the first real
> sign-in creates the user; re-`publish` the topic/lessons under that user, or
> migrate the `dev-user` rows to the new id.

## 3. R2 bucket (you / or via Cloudflare MCP)

Create the private bucket the worker binds:

```bash
pnpm exec wrangler r2 bucket create served-teach-artifacts
```

It is bound in `wrangler.toml` and served only through the worker (never public, ADR-0005).

## 4. Cloudflare login (you)

```bash
pnpm exec wrangler login
```

## 5. Secrets (you)

```bash
pnpm exec wrangler secret put DATABASE_URL          # production Neon pooled URL
pnpm exec wrangler secret put STACK_PROJECT_ID      # turns auth on
# STACK_SECRET_SERVER_KEY too, if/when server-side Stack calls are added
```

## 6. Build, deploy, publish

```bash
pnpm build                  # reader SPA → dist/client (served by the Worker)
pnpm run deploy             # wrangler deploy
pnpm run publish -- --remote   # push lesson/reference blobs to the real R2 bucket
```

## 7. Verify

- Visit the deployed URL → you should be sent to Neon Auth sign-in, then into the reader.
- Open a lesson, answer a quiz, ask a question, reload → progress dot persists; the answer/question are recorded under your real user.
- `pnpm run review` (with `DATABASE_URL` pointed at production) shows your activity.

## Notes

- **Custom domain**: add it in the Cloudflare dashboard (Workers → your worker → Domains) or `wrangler.toml` `routes`.
- **Cloudflare Access** was considered (ADR-0004) but we chose Neon Auth for in-app login. If you later want an extra edge gate, add an Access policy in Cloudflare Zero Trust over the worker route — it composes with Neon Auth.
