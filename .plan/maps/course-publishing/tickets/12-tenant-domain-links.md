---
type: task
blocked_by: []
---

# Tenant-domain link generation

## Question

A tenant course's server-built buy/invite links currently land on the deployment-wide `SITE_URL`, not
the owning tenant's subdomain. The user requires they come from the tenant domain — while preserving
the open-redirect guard that feeds PayFast's return URLs. Ground truth:
[ticket 08](08-tenant-domain-links.md), the scratch `research-subdomain-serving.md`.

Scope:
- **`appUrl`** (`convex/payfast.ts:232`) gains an optional trusted `tenantSlug`. Derive the origin
  `https://<tenantSlug>.<base>` where `base` = `rootOf(SITE_URL)` — the `SITE_URL` host with a leading
  `www` stripped (a ~2-line pure derive; **do not** import Next's `canonicalRedirect` across the
  runtime boundary). `tenantSlug` undefined → keep `SITE_URL` verbatim; a `localhost` `SITE_URL` also
  kept verbatim (no dev-subdomain machinery). Run the **existing same-origin guard against the
  resolved origin** (off-origin / protocol-relative → resolved-origin root). No allow-list —
  `tenantSlug` is a trusted topic column, so the resolvable set is implicitly
  `{ SITE_URL } ∪ { <slug>.<base> × 4 }`.
- **Route the two server-built link sites through it**, passing `topic.tenantSlug`: `startCheckout`'s
  `return_url`/`cancel_url` (`market.ts:432-433`), and `scheduleInvite`'s deep-links (`shares.ts:16-41`,
  replacing the raw `APP_BASE_URL` string-concat at `shares.ts:21`).
- **Retire `APP_BASE_URL` onto `SITE_URL`** — remove it from `convex/env.ts`, `shares.ts`, and
  provisioning/docs. One base-domain convention, one helper.
- **Explicitly unchanged:** `notify_url` stays `CONVEX_SITE_URL` (`market.ts:434`); public/share links
  stay client-side on `window.location.origin`; content-blob / catalogue deep-links stay on
  `CONVEX_SITE_URL`. `tenantBrand` remains the issue-14 brand seam.

Migration gotcha: after consolidation invite links flow through `appUrl`, which **throws when
`SITE_URL` is unset** — tests exercising `scheduleInvite` (today relying on `APP_BASE_URL` absent →
relative links) must provision `SITE_URL` (audit `convex/shares.test.ts` / `invite-emails.test.ts`).

Tests (write first): `appUrl("/x", "upf")` → `https://upf.my-course.app/x`; `appUrl("/x")` → `SITE_URL`
origin unchanged; open-redirect `appUrl("https://evil.com", "upf")` / `appUrl("//evil.com", "upf")` →
resolved tenant-origin root; `localhost` `SITE_URL` + slug → keeps localhost; `startCheckout` for a
tenant course emits return/cancel on `<slug>.<base>`, a default-site course on `SITE_URL`;
`scheduleInvite` builds the tenant deep-link and brand still resolves.

## Done when

Typecheck / codegen clean; `APP_BASE_URL` gone from the codebase; all link tests pass; the same-origin
guard is preserved per-tenant; invite/checkout tests provision `SITE_URL` and stay green.

## Answer

Done 2026-07-23 (`/tdd` + `/ponytail`). `appUrl(path, tenantSlug?)` derives `<slug>.<base>` and is
routed through checkout return/cancel + invite deep-links; `APP_BASE_URL` retired onto `SITE_URL`. The
open-redirect guard is preserved per-tenant. Full convex suite + `tsc` green. (This issue shipped
separately from the main 2026-07-28 build; it parallels 09/10/11 and no downstream issue blocks on
it.)
