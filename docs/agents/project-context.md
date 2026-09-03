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
- **CLI auth is a per-repo deploy key, not the global login.** This machine runs
  two Convex accounts (company Y-Knot/FuelSwitch + the personal course app), and
  the CLI stores ONE token at `~/.convex/config.json` — so `npx convex login` is a
  machine-wide toggle. To skip the logout/login churn, this repo pins a **dev
  deploy key** in `.env.local` (`CONVEX_DEPLOY_KEY=dev:...|ey...`); the env var
  wins over the global login, so `npx convex dev`/`deploy` always run against this
  project's deployment. A **"You don't have access to the selected project"** error
  means the key is missing/stale (regenerate: personal account → dev deployment →
  Settings → Deploy keys), not a code problem. A plain dev key can lack perms for
  `convex logs`/env reads — grant those role actions when generating if needed.
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
  project and serve the app directly; `SITE_URL` can be the apex. `SITE_URL` is
  the single web-app origin for both PayFast return URLs and invite-email links —
  a tenant course's server-built links ride its own subdomain, derived as
  `<slug>.<base>` (base = `SITE_URL` host minus a leading `www`; `appUrl` in
  `convex/payfast.ts`). The old `APP_BASE_URL` var was retired onto `SITE_URL`.
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

### Per-tenant sessions: cookies are host-only (no `NEXT_PUBLIC_COOKIE_DOMAIN`)

- **Each tenant subdomain has its own session, app language and theme.** Signing in
  on `ywampotch.my-course.app` does not sign you in on the apex or another tenant,
  so two different accounts can be signed in side by side in one browser. This is
  simply the browser's default: no cookie carries a `Domain`. Design: **ADR 0025**,
  which supersedes ADR 0022 §4a.
- **There is no cookie-scope env var and no pnpm patch, deliberately.** Both existed
  to do the opposite (a parent `Domain` plus a patched `__Host-`→`__Secure-` prefix
  so the session could span subdomains) and both are deleted. The session cookie is
  back on upstream `@convex-dev/auth` defaults, which removes the chore of re-cutting
  the patch on every auth bump. **Do not reintroduce `NEXT_PUBLIC_COOKIE_DOMAIN`** —
  setting it is what shared one account across every brand.
- **Cookie names:** `hindi_lang` (app language) and `hindi_mode` (light/dark), both
  host-only. Renamed from `hindi_locale` / `hindi_theme` at the cutover so the old
  parent-domain cookies — still in browsers, year-long max-age — can't shadow the new
  host-only ones under the same name. `hindi_mode` is also hardcoded in a regex in
  `src/app/layout.tsx`'s pre-paint script, invisible to rename tooling.
- **The cutover signed every user out once**, and reset language (back to the
  `Accept-Language` sniff) and theme (back to light). Expected and accepted.

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

## Analytics: PostHog (wired 2026-09-03)

**ADR 0030 line 132 says "PostHog is not wired". That was true when written and
is stale from 2026-09-03.** The ADR stands as the record of what was decided;
this section is the current state.

- **EU Cloud, project `264778`.** The project token and the ingestion host are a
  **matched pair per region**: an EU token against the US host is rejected, not
  rerouted. Direct EU ingestion is `https://eu.i.posthog.com` (the `i.` host is
  ingestion, `eu.posthog.com` is the UI).
- **Ingestion goes through a managed reverse proxy, `https://t.my-course.app`**
  (2026-09-03), configured PostHog-side under Settings, Managed reverse proxy. It
  is a first-party CNAME, which is the whole point: ad blockers and browser
  tracking-protection lists match on third-party `*.posthog.com` requests, so
  direct ingestion silently loses a chunk of events.
  - **`t` is therefore not available as a tenant slug.** `t.my-course.app` is a
    CNAME to PostHog and never reaches Vercel, so a tenant added to
    `TENANT_SLUGS` under that name would resolve in `src/lib/tenant.ts` and then
    404 in the browser. There is a comment on the constant saying so.
  - **A proxy api_host breaks posthog-js's `ui_host` inference**, so
    `PostHogClient.tsx` names `https://eu.posthog.com` explicitly. Without it the
    SDK reuses `api_host` verbatim and the toolbar and "view in PostHog" links
    point at the proxy. If the proxy domain ever changes, that line does not.
- **Browser only.** `posthog-js` in `package.json`; there is no server SDK and no
  server-side capture. The singleton is initialised by `initializePostHog()` in
  `src/app/PostHogClient.tsx`, mounted from `src/app/layout.tsx`.
- **Two client env vars**, both `.optional()` in `env.js`:
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`.
  - **A missing value is a silent no-op in production.** Optional in the schema
    means the build stays green, and `PostHogClient.tsx` only throws when
    `NODE_ENV === "development"`; in production it just returns `false`. So a
    misconfigured deploy captures nothing and reports nothing. There is no alarm
    to wait for, check the PostHog inbox.
  - **`NEXT_PUBLIC_*` is inlined at build time, not read at runtime.** Both must
    exist in Vercel *before* the build, on Production and Preview, and an env-var
    change only takes effect on a **fresh deploy**: the old bundle keeps the old
    baked-in value.
- **Identity is the Convex user document ID** (immutable), read via `users.me` in
  `convex/users.ts` and passed to `posthog.identify` in
  `src/app/ConvexClientProvider.tsx`, **and it is the only thing sent**. No person
  properties at all: no email, no name (2026-09-03). Email and name were sent until
  that date; they were dropped so that fault-diagnosis data, which includes what a
  page looked like, is not directly identifying at the provider. `/privacy` promises
  this in as many words, so the two move together. **`posthog.reset()` runs before
  Convex sign-out** at all
  three sign-out sites: `Dashboard.tsx`, `CourseShell.tsx`, `SettingsPage.tsx`.
  Keep that ordering if you add a fourth, or the next visitor inherits the
  previous person.
- **Eight events**, all non-PII properties: `auth_password_submitted`,
  `auth_google_started` (`SignIn.tsx`), `access_code_join_submitted`
  (`JoinPanel.tsx`), `voucher_redeemed` (`RedeemPanel.tsx`),
  `checkout_card_started`, `checkout_eft_started` (`CheckoutPage.tsx`),
  `quiz_answered`, `lesson_completed` (`ArtifactView.tsx`). The two auth events
  and the join event are deliberately **personless**: identity doesn't exist yet
  at those boundaries.
- **Error tracking:** `capture_exceptions: true` on init, plus the App Router
  boundary `src/app/global-error.tsx` calling `captureException`.
- **Session Replay is on and recording** (enabled PostHog-side, not in code).
  Learner sessions are being recorded; if `/privacy` doesn't say so, it should.
- **Self-driving was switched on 2026-09-03**: four scouts, error/health/support
  signal sources, inbox at
  <https://eu.posthog.com/project/264778/inbox>. It can open PRs at $15 flat each,
  capped by a monthly limit in the PostHog sidebar. **PostHog's UI is the source of
  truth for all of that**, not this file, so don't transcribe the scout roster here,
  it drifts.
- **The wizard (`npx @posthog/wizard`) leaves scratch behind.** `.posthog-wizard-cache/`,
  `.claude/skills/integration-nextjs-app-router/` and
  `posthog-self-driving-report.md` are all gitignored; commit `9f482c9` committed
  the 69-file cache by accident and `d822c24` removed it. Rerunning the wizard
  regenerates any of them.

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
- **Status (as of 2026-07-29): the rail is LIVE and taking real money.** FICA
  verification cleared and **5 real purchases have completed** on prod. Auth-first
  checkout + open sign-up + the marketplace are implemented and merged to `main`.
  Prod is provisioned with the operator's LIVE merchant (`29853249`),
  `PLATFORM_FEE_BPS=5000`, `SITE_URL=https://my-course.app`.
  - **Treat the rail as production infrastructure**: don't refactor
    `convex/payfast.ts` or `market.startCheckout` casually, and don't test against
    prod. The diagnosed funnel problems are *checkout abandonment* and *sign-up
    friction* — the rail itself is not the fault (see
    `.plan/maps/ywampotch-launch/spec.md`; the older
    `.scratch/ywampotch-launch/PRD.md` is superseded).
  - The earlier "pending FICA → pause selling with `PAYFAST_MODE=off`" instruction
    is **retired**. `off` remains the kill switch in `convex/env.ts`, but nothing
    is asking you to use it.
  - The **dev** deployment runs `PAYFAST_MODE=sandbox` (verified 2026-07-29) —
    sandbox merchant `10051521`, passphrase `jt7NOE43FZPn`. Never mix live and
    sandbox accounts.
  - **Prod `PAYFAST_MODE` is `live`** (read from prod 2026-07-29).
  - **`--prod` does not work here — pass the key instead.** `.env.local` pins a
    *dev* `CONVEX_DEPLOY_KEY`, and the env var **wins over `--prod`**: `npx convex
    env get X --prod` prints *"Ignoring `--prod` … using deployment from
    CONVEX_DEPLOY_KEY"* and answers for **dev**, which reads exactly like a prod
    answer. `.env.local` also holds `PROD_CONVEX_DEPLOY_KEY`, so to read prod:

    ```sh
    CONVEX_DEPLOY_KEY="$PROD_CONVEX_DEPLOY_KEY" npx convex env get PAYFAST_MODE
    ```

    Same override applies to `convex env list` / `convex logs`. Prefer fetching the
    one var you need over dumping the whole env — the PayFast merchant key and
    passphrase live there too.

## Bulk access: there are TWO rails, not one (2026-08-23; renamed 2026-08-25)

**The product names and the code names differ, on purpose.** Renamed on 2026-08-25 after the
operator walked both rails: "Access Code" described the string rather than the deal. **The
identifiers were deliberately NOT migrated** - renaming a Convex table is a data migration, and
buying a word with one is a bad trade. So:

| Product name | Code |
| --- | --- |
| **Organisation Voucher** | `accessCodes` table, `seats` table, `convex/accessCodes.ts`, `mintAccessCode`, `/join` |
| **Bulk Vouchers** | `voucherBatches` table, `vouchers` table, `convex/vouchers.ts`, `mintBatch`, `/redeem` |

ADRs 0029 and 0031 use the old names throughout and **are not edited**: they are the record of what
was decided when. Read them with this table beside them.


An organisation buying course access for its people can be served two ways, and both
are built. A new agent that finds only one of them in the notes will reason about the
wrong deal, so both are here with the rule for which applies.

- **Voucher Batch** ([ADR 0029](../adr/0029-seller-minted-voucher-rail.md),
  `convex/vouchers.ts`, `/redeem`). The Seller mints **N single-use codes** for one
  Edition and states the **negotiated total for the whole batch**. The Ledger row is
  written **at mint**, held `unpaid`, and the codes work immediately, so the seats are
  live before the money arrives. A redemption records **nothing about who redeemed**.
  Use it when the organisation knows how many seats it wants and is content to be
  billed upfront, and when the members already have, or will happily make, accounts
  with email addresses.

- **Access Code** ([ADR 0031](../adr/0031-shared-capped-access-codes-and-nickname-seats.md),
  `convex/accessCodes.ts`, `/join`). The Seller mints **one shared, capped code** for
  one Edition and states a **per-seat price**. A member joins with a self-chosen
  **nickname and a PIN, never an email**, and each join consumes a **Seat**. The
  Ledger row is written **when the Seller stops the code**, for the seats actually
  taken, so the total is unknown until the agreement ends. Use it when the
  organisation wants one thing to broadcast (a WhatsApp group, a public meeting) and
  does not know how many of its people will take the course.

Facts about the second rail that are easy to get wrong:

- **A `seats` row links a person to the organisation's cohort**, which ADR 0029
  refused and ADR 0031 deliberately reverses. It is the whole reason a superseding ADR
  exists. What makes it defensible is that the handle is **self-chosen** and `/join`
  says so in those words. **If any UI ever nudges members toward their real name, the
  POPIA mitigation is gone** (a real name beside a political party's cohort is special
  personal information under s26 via s1).
- **The Entitlement a Seat mints carries no provenance**, exactly as a voucher seat's
  does not. `convex/accessCodes.test.ts` pins its key set, so adding an `accessCodeId`
  back fails a test rather than quietly ending the promise.
- **The PIN is unrecoverable, forever, and there is no reset flow.** A reset needs a
  second channel and the second channel is the email this rail exists to avoid.
  Nobody has priced the support burden of this at the scale of a party's membership;
  if it turns out to be constant, the rail needs a redesign rather than a patch.
- **Both rails settle on the manual EFT path** in the admin portal's Payouts tab, and
  **the platform generates no invoice document**. The operator raises the invoice
  elsewhere from the queue line. PayFast has no invoicing product at all (a
  case-insensitive grep for "invoice" across its whole developer-docs bundle returns
  zero hits), which is why.
- **A Seat earns no Certificate, and this is ENFORCED** (`isEligible` in
  `convex/certificates.ts`), not merely documented. It was documented-only until
  2026-08-26 and therefore did not work. Two reasons: a Certificate is losable with a
  forgotten PIN and there is no recovery, and more sharply, a Certificate prints and
  stores a name the learner types, which is the real name beside a cohort that the whole
  nickname mitigation exists to prevent. A Seat that adopted an email is still refused.
- **The consent wording is versioned in `convex/joinConsent.ts` and is append only.**
  Editing an existing version rewrites what an already-joined member is recorded as
  having agreed to. `seats.consentVersion` resolves against it, and `/join` renders
  the translated form while the English there stays the record.
- **`lucia` is a direct dependency for one import**, the scrypt that hashes a PIN.
  `Password`'s own crypto cannot be borrowed: `ConvexCredentials()` hides its real
  config under an internal `options` key.

## Whitelabel LMS (the end goal)

The project is not just the Hindi / "My Course" app — the goal is a **whitelabel
course-generator LMS platform**: one codebase, multiple branded tenant sites.
Initial tenants: **upf, ywampotch, almighty-warriors, yknot**, each on its own
subdomain, each with its own styling and features toggled on/off. Scoping lives
in [`.plan/maps/whitelabel/`](../../.plan/maps/whitelabel/map.md) (corrected
2026-09-01: the old pointer here was `.scratch/whitelabel/`, retired on
2026-07-30 when maps became the one home for tickets; those files still exist on
disk as history only). The follow-on effort that grows the flag set is
[`.plan/maps/tenant-feature-modularity/`](../../.plan/maps/tenant-feature-modularity/map.md).

- **Feature flags: SIX, not five** (corrected 2026-09-01). Five flat **required**
  booleans on `tenants.flags` (`certificates`, `translations`, `publicLinks`,
  `qa`, `seeding`), all `true` at the v1 migration, plus `donations`, which is
  **optional** and defaults off (ADR 0027, added 2026-08). Enforced by an
  `assertTenantFlag(ctx, tenantSlug, flag)` helper in `convex/tenantFlags.ts`,
  called explicitly from each gated mutation; `getOwnedTopic`/
  `getViewableTopic` stay flag-agnostic. Flag-off is frozen-not-revoked (blocks
  new grants only); a flag added later defaults `false`.
  - **A flag gates the server, not the UI.** Only `donations` hides its own
    affordance (`src/app/donate/page.tsx`, `DonateSection.tsx`). For the other
    five the button is still rendered and the click throws *"This feature isn't
    available on this site."* Verified 2026-09-01. Closing that gap is the
    tenant-feature-modularity map's job; until it lands, do not assume a flag
    makes anything disappear.
  - **`selling` does not exist yet.** Selling is gated per-seller
    (`isReadySeller`) and deployment-wide (`PAYFAST_MODE`), with no tenant grain.
    The flag is fully scoped and unbuilt at
    [course-publishing ticket 11](../../.plan/maps/course-publishing/tickets/11-per-tenant-selling-flag.md).
    Both voucher rails and the manual EFT rail are likewise ungated per tenant.
- Treat single-site assumptions (site-wide Allowlist, one Resend domain, one
  payments merchant) as **tenancy debt** when you touch them. (The one-Admin
  assumption is retired — see the two-tier admin model below.)
- **Admin roles are two-tier** (ADR 0022 §4, issue 08): a `whitelist` row with
  `isAdmin` and no `tenantSlug` is a **sys admin** (global); with a `tenantSlug`
  it's a **tenant admin** (that tenant only). `isCallerAdmin(ctx, tenantSlug?)`
  is scope-aware — no arg = "is sys admin"; `amITenantAdmin` is the client seam.
- **Producing a tenant's branding** (palette JSON + logo/favicon from a Claude
  design system): see [tenant-branding.md](tenant-branding.md) —
  `pnpm tenant-branding validate|logo|favicon`, then seed + `setTenantAsset`.

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

- **Samsung Internet cannot install the PWA, and the cause is not ours**
  (diagnosed 2026-08-25). Two separate Samsung regressions, neither reachable
  from this codebase:
  1. **Play Protect blocks the install.** *"Unsafe app blocked. This app was
     built for an older version of Android and doesn't include the latest
     privacy protections."* Android 14 enforces a **minimum installable
     `targetSdk` (23)** at the OS level, for sideloads too. A PWA install is a
     **WebAPK**: a real APK generated by a minting server, Google's when the
     browser is Chrome, **Samsung's own on Samsung devices**. Samsung's minter
     stamps a `targetSdk` below the threshold, so the OS refuses its output.
     `targetSdk` lives in the generated APK's `AndroidManifest.xml` and there is
     **no web-app-manifest member that maps to it**: the minting server takes
     name, icons, colours, display, scope and start_url, nothing else.
  2. **Samsung Internet 27+ no longer fires `beforeinstallprompt`** (Samsung's
     stated position: it is a Chrome-specific non-standard extension and they
     want installs to go through their own menu). So `InstallSheet` never
     renders there either. Samsung users install via the browser's own
     **Add page to > Home screen**, which is what hits regression 1.
  **Our side is verified clean** (curled prod 2026-08-25):
  `https://ywampotch.my-course.app/manifest.webmanifest` returns 200
  `application/manifest+json` with valid `name`/`id`/`start_url`/`scope`/
  `display`/`theme_color`, and all three `/app-icon` sizes return 200 `image/png`
  (9996 / 53250 / 35692 bytes), publicly, no redirects, no auth. Minting has
  everything it needs. **So do not chase manifest fields, icon formats, service
  worker scope or HTTPS config**: none of them can move `targetSdk`.
  **The only fix inside our control is to stop relying on a minted WebAPK** and
  ship a real signed app: a Bubblewrap/PWABuilder **TWA** with a current
  `targetSdk`, on the Play Store, with Digital Asset Links on the tenant domain.
  That is a real project (Play Console account, per-tenant signing or one shell
  app that takes the tenant host), not a patch. **Until then, what ships is the
  redirect** (`isSamsungInternet` + `chromeIntentUrl` in
  `src/app/_components/installPromptDerive.ts`): Samsung renders the sheet on
  user agent alone, since the event never fires there, and gets a notice saying
  Samsung cannot install the app plus an **Open in Chrome** button on an Android
  intent URL. It is a workaround and is labelled as one; the block itself stays
  Samsung's until the TWA exists.

## Editing a shipped Edition

Changing the content of an Edition that is already in the Hub goes through the
**local round-trip**: `pnpm edition:pull:prod` to disk, edit `working/`, `pnpm
edition:push:prod` back (dry run unless `--go`). It sends only what changed plus
every blob-backed row, and refuses the whole run on a quiz-marker drift, a
surviving static-block placeholder, or a blanked text row. Added 2026-09-01,
generalising the two one-off scripts that came before it. Full contract, and the
traps each of those two hit, in
[docs/agents/edition-round-trip.md](edition-round-trip.md).

English is the **source** Edition and is not editable this way: use
`scripts/publish.ts`.

## Repo gotchas

- **`.claude/skills/<skill>` shared entries are directory symlinks into
  `.agents/skills/<skill>`** — not duplicates. `diff -rq` follows the symlinks
  and falsely reports them identical; `git rm -r .agents/skills` dangles every
  `.claude` symlink and wipes the skills. Verify with `ls -ld` / `readlink`
  before touching.
  - **The real (non-symlink) dirs under `.claude/skills` are** (verified
    2026-07-29): `teach`, `html-demo-wizard`,
    `thermo-nuclear-code-quality-review`, and the six Convex ones (`convex`,
    `convex-create-component`, `convex-migration-helper`,
    `convex-performance-audit`, `convex-quickstart`, `convex-setup-auth`).
    The design-family list this note used to carry (banner-design, brand,
    design, design-system, slides, ui-styling, ui-ux-pro-max) was already
    wrong — those dirs exist in neither tree and were never tracked in git.
  - **`teach` is a real dir in BOTH trees — they are two files, not a symlink, so
    they can drift silently.** They did: `.agents/skills/teach/SKILL.md` was missing
    "Terminating a Course", "Choosing the Emblem" and "The Lesson-Count Estimate",
    and since the **Routine reads `.agents/`**, unattended runs were authoring
    without the course-termination, Emblem and lesson-count guidance that ADR 0017
    and ADR 0018 assume. **Resynced 2026-07-29** — the two are now content-identical
    (189 lines). When you edit one, edit the other, or the Routine and interactive
    sessions will disagree again.
- **Conventional-commit subjects on `main` are not trustworthy** — several
  changes from the parallel-agent batches landed under the wrong message,
  because concurrent sessions share one git index and `git commit --only <paths>`
  was not always used. Two confirmed examples: `792a20a`
  ("feat(auth): implement Google sign-in and improve session persistence") adds
  **only** `.scratch/google-signin/PRD.md` — no Google provider was written, and
  #111/#112 are still genuinely open; `02aedcb` ("feat(publish): publishedEditions
  table…") also carries +109/+145 lines of the **tenant-admin scoping** work in
  `convex/tenants.ts`. **Read the diff, never the subject**, and expect
  `git blame`/`git bisect` to point at the wrong commit for anything in that
  window (roughly 2026-07-27 → 2026-07-29).
