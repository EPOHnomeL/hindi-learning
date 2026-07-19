# course-publishing/12: Tenant-domain link generation

**Status:** ready-for-agent
**Depends on:** —
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 08](08-tenant-domain-links.md),
[08-research-subdomain-serving.md](08-research-subdomain-serving.md) (how subdomains are served today
— don't re-derive).

## Why

A tenant course's server-built buy/invite links currently land on the deployment-wide `SITE_URL`, not
the owning tenant's subdomain. The user requires they come from the tenant domain — while preserving
the open-redirect guard that feeds PayFast's return URLs.

## Scope

**`appUrl`** (`convex/payfast.ts:232`) gains an optional trusted `tenantSlug`:

```ts
export function appUrl(path = "/", tenantSlug?: string): string { … }
```

- Derive the origin: `https://<tenantSlug>.<base>` where `base` = `rootOf(SITE_URL)` — the `SITE_URL`
  host with a **leading `www` stripped** (`https://www.my-course.app` → base `my-course.app` →
  `https://upf.my-course.app`). This is a ~2-line pure derive inside `appUrl`; **do not** import Next's
  `canonicalRedirect` (`src/lib/tenant.ts:40`) across the Next↔Convex runtime boundary.
- `tenantSlug` **undefined** → keep `SITE_URL` verbatim (default-site behaviour, unchanged). A
  `localhost` `SITE_URL` has no subdomains → also keep it verbatim (no dev-subdomain machinery).
- Run the **existing same-origin open-redirect guard against the resolved origin** (off-origin /
  protocol-relative path → resolved-origin root, exactly as today). No allow-list: `tenantSlug` is a
  trusted topic column, never client input, so the resolvable set is implicitly
  `{ SITE_URL } ∪ { <slug>.<base> × 4 }`.

**Route the two server-built link sites through it, passing `topic.tenantSlug`:**

- **`startCheckout`** `return_url` / `cancel_url` (`market.ts:432-433`) — `appUrl(path, topic.tenantSlug)`.
- **`scheduleInvite`** deep-links (`shares.ts:16-41`) — replace the raw `APP_BASE_URL` string-concat
  (`shares.ts:21`) with `appUrl(path, topic.tenantSlug)`. `scheduleInvite` already resolves the topic's
  tenant for branding (`tenantBrand`), so the slug is in hand.

**Retire `APP_BASE_URL` onto `SITE_URL`** — both are Convex env vars holding the same web-app origin.
Remove `APP_BASE_URL` from `convex/env.ts` (it isn't declared there yet — the shares path reads
`process.env.APP_BASE_URL` directly), from `shares.ts`, and from provisioning/docs. One base-domain
convention, one helper.

**Explicitly unchanged** (don't touch): `notify_url` stays `CONVEX_SITE_URL` (ITN, tenant-agnostic,
reachability fine — `market.ts:434`); public/share links stay client-side on `window.location.origin`
(already tenant-correct by construction — `src/app/_components/Editions.tsx`); content-blob / catalogue
deep-links stay on `CONVEX_SITE_URL`. `tenantBrand` remains the issue-14 brand seam.

## Migration gotcha

After consolidation, invite links flow through `appUrl`, which **throws when `SITE_URL` is unset**.
Tests that exercise `scheduleInvite` and today rely on `APP_BASE_URL` being absent (→ relative links)
must **provision `SITE_URL`**. Audit `convex/shares.test.ts` / `invite-emails.test.ts` and set it.

## Tests (write first)

- `appUrl("/x", "upf")` → `https://upf.my-course.app/x` (base from a `www.`-prefixed `SITE_URL`);
  `appUrl("/x")` → `SITE_URL` origin unchanged.
- Open-redirect: `appUrl("https://evil.com", "upf")` and `appUrl("//evil.com", "upf")` → resolved
  tenant-origin root, not evil.com.
- `localhost` `SITE_URL` + a slug → keeps localhost (no subdomain).
- `startCheckout` for a tenant course emits return/cancel on `<slug>.<base>`; a default-site course on
  `SITE_URL`.
- `scheduleInvite` for a tenant course builds the deep-link on `<slug>.<base>`; brand still resolves.

## Acceptance criteria

- Typecheck / codegen clean; `APP_BASE_URL` gone from the codebase.
- All link tests pass; the same-origin guard is preserved per-tenant.
- Invite/checkout tests provision `SITE_URL` and stay green.

**Independent** — parallels 09/10/11; no downstream issue blocks on it.
