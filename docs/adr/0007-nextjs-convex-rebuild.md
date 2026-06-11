# Next.js + Convex rebuild (supersedes 0004, 0005, 0006)

The implementation is rebuilt on **Next.js (App Router) on Vercel** with
**Convex** as the single backend (database, server functions, realtime, and
auth via **Convex Auth**). This supersedes the Cloudflare-Access auth (0004),
R2 artifact store (0005), and Neon Auth (0006) decisions, and replaces the Vite
SPA + Cloudflare Worker + Neon stack.

## Context

The original stack spread one small app across Cloudflare Workers, Neon
(branch-per-env), R2, and Neon Auth. The cost was operational, not conceptual:
fragile auth (third-party cookie / same-origin proxy / JWKS / trusted origins),
credentials duplicated across `.env` / `.dev.vars` / `.env.production` / Wrangler
secrets / the cloud-routine env, and R2 writes shelling out to `wrangler`. Sign-in
broke repeatedly. The domain (PRD §4) is simple and does not justify that surface.

## Decision

- **Convex** holds the Hub tables (`topics`, `lessons`, `references`) and the
  capture tables (`responses`, `progress`, `questions`), with server functions
  in `convex/`. Lesson/reference HTML is stored as a document field — no separate
  object store. Realtime subscriptions replace manual cache-busting.
- **Convex Auth** (email/password) replaces all bespoke JWT/cookie/JWKS work.
- The **local workspace stays the source of truth** (0002 holds); `pnpm run
  publish` mirrors `lessons/` + `references/` into Convex via a `PUBLISH_SECRET`-
  guarded mutation. `review` / `reply` use the same path.
- **Immutable lessons / mutable references** (0003) is preserved in the schema
  and the publish mutations.

## Consequences

- One service, one set of credentials; sign-in is a managed concern.
- A single Convex deployment per environment — no local/remote publish split.
- The teach skill's commands (`publish` / `review` / `reply`) are unchanged for
  the authoring agent; only their implementation moved.
- Capture history from the old Neon DB was not migrated (started fresh).
