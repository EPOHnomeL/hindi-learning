# Project context

Durable project facts an agent needs but can't derive from the code or git
history alone. This file is the in-repo home for that knowledge (see the
"Context lives in the repo" rule in [CLAUDE.md](../../CLAUDE.md)). Keep it
current; delete facts that turn out wrong.

Dates are absolute. `[[links]]` in older notes have been resolved to sections here.

## Environments & deploy

- **Vercel deploys on push to `main`.** The GitHub integration builds a
  production deployment on every push to `main` (there is no in-repo
  `vercel.json`/`vercel.ts`, no `.github/workflows`, and the Vercel CLI isn't
  installed — the wiring lives on Vercel's side).
  - Team: `jonathan-6428's projects` → `team_pWPZwRSNsgPwZhgfoED4podg`
  - Project: `hindi-learning` → `prj_EpTp3OY6HHRta6NDxbVrNHpc719d`
  - Check builds via the Vercel MCP `list_deployments` (needs projectId +
    teamId). A Next build takes ~1–2 min; a local commit isn't live until pushed
    and built.
- **The build command is `npx convex deploy --cmd 'pnpm run build'`,** so every
  build also pushes Convex functions + schema:
  - Push to `main` → deploys Convex **prod**.
  - A PR preview build → deploys Convex to the **shared dev** deployment.
  - Convex validates data on push, so a **field removal needs the data stripped
    of that field first** (patch `{field: undefined}`) on the target deployment
    before the narrowing schema deploys — sequence it as its own earlier merge.
- **`npx convex codegen` here pushes to the shared dev deployment** — it doesn't
  just generate types locally; it uploads functions/schema to
  `dev:judicious-marmot-580`. A worktree has no `.env.local`, so codegen there
  needs `CONVEX_DEPLOYMENT="dev:judicious-marmot-580" npx convex codegen --typecheck disable`.
  Pushing `main` reconciles the shared dev schema to `main`'s and **drops
  indexes/tables that exist only on a concurrent branch** — non-destructive to
  data (indexes only); the other branch's next `convex dev` recreates them.
  Expect this tug-of-war when two branches with divergent schemas share dev.
- **Deployments:** prod is `capable-barracuda-769`; dev is `judicious-marmot-580`.
- **Real tenant/user accounts exist only on prod.** Dev holds just the two
  operator accounts (jvorster63@gmail.com, josuavorster2003@gmail.com). Any
  request to inspect/change a tenant's data is a **prod** operation — use the
  `PUBLISH_SECRET`-guarded operator CLIs (`pnpm <cmd>:prod`, e.g.
  `pnpm resource:prod --owner <email> --remove <resourceId>`) after a push to
  main deploys the functions. Convex `storage.getUrl` links are **permanent
  bearer URLs** — truly revoking access to a file means deleting the blob, not
  just the row; back a file up before deleting (never into the public repo).

## Domain & email

- **`my-course.app`** is the project's domain, registered via **Cloudflare**
  (2026-07-13). It (and `www`) are attached to the Vercel `hindi-learning`
  project and serve the app directly; `APP_BASE_URL` can be the apex.
- **Resend** sends invite email from an address on this domain
  (`INVITE_FROM_EMAIL`, e.g. `"Y-Knot Courses <invites@my-course.app>"`); the
  SPF/DKIM records live in Cloudflare.
- **Tenant subdomains** `upf`, `ywampotch`, `almighty-warriors` (plural), `yknot`
  `.my-course.app` are live over HTTPS — explicit Cloudflare CNAMEs →
  `cname.vercel-dns.com` (DNS-only), each added to the Vercel project.

## Environment variables

Validated with `@t3-oss/env` (see [env-validation](#env-validation-t3-oss-env)
below). PayFast rail vars live in `convex/env.ts`; the Next client var in
`env.js`.

### env validation (@t3-oss/env)

Two registries, one per runtime — they can't share (different bundlers,
deployments, env sources):

- **Next.js:** `env.js` at repo root (`@t3-oss/env-nextjs`), imported for its
  side effect in `next.config.js` so it validates at build. Holds
  `NEXT_PUBLIC_CONVEX_URL`.
- **Convex:** `convex/env.ts` (`@t3-oss/env-core`) — the PayFast rail vars
  (`PAYFAST_MODE`, `PAYFAST_MERCHANT_ID/KEY/PASSPHRASE`, `PLATFORM_FEE_BPS`,
  `SITE_URL`).

Gotchas:

- **Don't put a Convex-runtime var in `env.js`** (or vice-versa). PayFast vars
  are Convex-deployment vars, invisible to Next.
- **`convex/env.ts` exports `env()` as a FUNCTION, not a `const`** — it re-reads
  `process.env` per call. Convex reads env per-invocation (flip a var → no
  redeploy) and the tests toggle env per-test; a cached const freezes the first
  value and breaks both. `isServer: true` (the edge-runtime test env has no
  `window`).
- **`PAYFAST_MODE` is a zod enum `live | sandbox | off`** — `off` is the selling
  kill switch (pauses selling platform-wide, credentials left intact). Any other
  value throws. `PLATFORM_FEE_BPS` keeps a lenient 5000 fallback via `.catch()`.
- Convex bundling of `@t3-oss/env-core` + `zod` is only truly confirmed on a
  Convex deploy (tests run in edge-runtime). Pinned `@t3-oss/env@0.11.1` +
  `zod@3.25` for compat.

## Payments — PayFast rail

- **Gateway is PayFast (South Africa)**, a full replacement of the earlier Stripe
  Connect spine (pivot 2026-07-08/07-10). Stripe was ripped out, not run
  alongside.
- **Take-rate = 50%, split on the NET** (sale minus PayFast's processing fee),
  from the ITN's `amount_net`. `PLATFORM_FEE_BPS=5000` — **the bps is the
  PLATFORM's cut** (the var's name wins over the PRD's literal formula). Ledger
  fields: `sellerShare` / `platformShare`.
- **Operator is sole merchant-of-record.** All sales collect into the operator's
  one PayFast account; authors never register their own — no rail-level split
  payments.
- **Manual payouts via a `ledger` table** (gross/fee/net/seller-share/
  platform-share/status `owed`→`paid`); operator pays authors by EFT and marks
  paid.
- **Sellers** become ready via an Admin `can-sell` grant + **payout bank details
  on file**.
- **No refunds** — no automated refund/dispute handling; manual Admin
  `revokeEntitlement` is the only safety valve.
- **ZAR-only** pricing; buyer-side multi-currency display deferred.
- **Signature gotchas** (`convex/payfast.ts`): PayFast's MD5 signature is over
  the fields **IN ORDER** (documented attribute order for outgoing, received
  order for an ITN) — **never alphabetical**. Convex serializes objects with
  sorted keys, which destroys that order across a function boundary, so
  `market.startCheckout` returns `fields` as an ordered **array** of
  `{name, value}` pairs — never change it back to a record. Any new field must
  be inserted at its documented attribute position in `buildCheckoutFields`; the
  ITN postback body must stay `pfParamString(receivedFields)` (received order,
  minus `signature`, empties kept). Tests pin both.
- **Go-to-market is a gated, four-phase roadmap** — subtraction not accumulation,
  each phase unlocked by evidence not ambition. Phase 1 (the only one that
  matters now): PayFast for SA, ZAR card + Instant EFT, priced R100–R500, owner
  as seller of record; gate ~100+ paid courses/month. Don't build Phase 2–4
  (other African countries, mobile money, India) plumbing before Phase 1 sells.
- **Status (as of 2026-07-17):** auth-first checkout + open sign-up + the
  marketplace are implemented and merged to `main`. Prod is provisioned with the
  operator's LIVE merchant (`29853249`), `PAYFAST_MODE`, `PLATFORM_FEE_BPS=5000`,
  `SITE_URL=https://my-course.app`. The **live PayFast account is pending FICA
  verification** ("this merchant account is currently not able to receive
  payments"), so selling should be paused (`PAYFAST_MODE=off`) until it clears.
  Live sandbox merchant for testing was `10051521` (passphrase `jt7NOE43FZPn`);
  never mix live and sandbox accounts.

## Whitelabel LMS (the end goal)

The project is not just the Hindi / "My Course" app — the goal is a **whitelabel
course-generator LMS platform**: one codebase, multiple branded tenant sites.
Initial tenants: **upf, ywampotch, almighty-warriors, yknot**, each on its own
subdomain, each with its own styling and features toggled on/off. Scoping lives
under `.scratch/whitelabel/` (source of truth: `issues/00-whitelabel-map.md`,
which decays every session — re-verify before resuming).

- **Feature flags:** five flat required booleans on `tenants.flags`
  (`certificates`, `translations`, `publicLinks`, `qa`, `seeding`), all `true` at
  the v1 migration. Enforced by an `assertTenantFlag(ctx, tenantSlug, flag)`
  helper called explicitly from each gated mutation; `getOwnedTopic`/
  `getViewableTopic` stay flag-agnostic. Flag-off is frozen-not-revoked (blocks
  new grants only); a flag added later defaults `false`.
- Treat single-site assumptions (site-wide Allowlist, exactly-one Admin, one
  Resend domain, one payments merchant) as **tenancy debt** when you touch them.

## Product rules

- **A Viewer switches language only among the editions actually shared to them.**
  If they hold >1 shared edition they get the switcher (scoped to their held
  editions, like an owner's is scoped to source + ready translations); a
  single-edition Viewer sees no switcher. In `CourseShell.tsx` the
  `LanguageSwitcher` is gated by `header.editions.length > 1` **only** (NOT
  `canWrite`) — do not re-add an owner gate. The backend already scopes
  `courseHeader.editions` to held languages.

## UI

- The dashboard + course-view **UI redesign is wired into React** (2026-07-06,
  Convex logic reused unchanged). Components live under `src/app/_components/`:
  `icons.tsx` (inline-SVG `Icon` set, replacing emoji), `ui.tsx`
  (`IconButton`/`Dialog`/`Menu`/`ConfirmDialog`), `CourseSettings.tsx`,
  `Editions.tsx` (tabbed dialog; sharing lives inside Editions; editions are
  tabs with a `+` to add a language; the public link is a lock→globe toggle).
  It was prototyped as a hosted Claude Artifact
  (<https://claude.ai/code/artifact/af1d82a5-aeb7-4f78-b8e6-110e8007d4c2>) before
  the React wiring. This is the substrate the whitelabel theming tokenises.

## Repo gotchas

- **`.claude/skills/<skill>` shared entries are directory symlinks into
  `.agents/skills/<skill>`** — not duplicates. `diff -rq` follows the symlinks
  and falsely reports them identical; `git rm -r .agents/skills` dangles every
  `.claude` symlink and wipes the skills. Only the design-family skills
  (banner-design, brand, design, design-system, slides, ui-styling,
  ui-ux-pro-max, thermo-nuclear-code-quality-review) are real dirs unique to
  `.claude/skills`. Verify with `ls -ld` / `readlink` before touching.
