# whitelabel/17: Feature flag enforcement

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[04 — Resolution](04-scope-per-tenant-feature-flags.md) decisions 2–4 and the worked example.

## Why

Flags are only real if they're enforced server-side — the ticket was explicit that hidden
buttons aren't enough, since every flaggable feature has a Convex function a client could still
call directly.

## Scope

- New `assertTenantFlag(ctx, tenantSlug: string | undefined, flag: keyof TenantFlags)` in
  `convex/lib.ts`:
  - No-ops when `tenantSlug` is `undefined` (default site / not-yet-tenanted content) — every v1
    flag is implicitly on off-tenant, matching today's behaviour exactly, no regression.
  - Otherwise looks up the `tenants` row by `by_slug` and throws if `flags[flag]` is not `true`.
- `getOwnedTopic`/`getViewableTopic`/`getEditableTopic` stay **flag-agnostic** — do not touch
  them. Call `assertTenantFlag` explicitly, inline, in each of the five create-side mutations:
  - `claimCertificate` ([`certificates.ts`](../../../convex/certificates.ts)) — flag
    `certificates`, tenant from the resolved Topic.
  - `setTopicPublic` / `setEditionPublic` ([`shares.ts`](../../../convex/shares.ts)) — flag
    `publicLinks`, tenant from the resolved Topic.
  - `askQuestion` ([`capture.ts`](../../../convex/capture.ts)) — flag `qa`, tenant from the
    resolved Topic.
  - `startTranslation`'s `tryAcquireTranslation` ([`translate.ts`](../../../convex/translate.ts))
    — flag `translations`, tenant from the resolved Topic.
  - `seedTopic` ([`content.ts`](../../../convex/content.ts)) — flag `seeding`, tenant from **the
    calling user's own** `tenantSlug` (there is no Topic yet at creation time).
- **Read paths are untouched** — `myCertificate`/`publicCertificate`, the Editions panel's
  existing-link display, `myQuestions`, etc. never call `assertTenantFlag`. This is what makes
  flag-off frozen-not-revoked: only the create path is gated, so anything already granted keeps
  resolving forever.
- Client-side belt-and-suspenders (hiding the button when the client tenant context's `flags`
  says off) is [21](21-dashboard-flag-toggles.md)'s concern, not this one — this issue is the
  server-side throw, which is the part that actually matters.

## Acceptance criteria

- With a tenant's `certificates` flag `false`, calling `claimCertificate` for a Topic on that
  tenant throws — verified by a direct mutation call in a test, not just checking the UI.
  Repeat for the other four flag×mutation pairs.
- A Certificate/Edition/Question/Public-link/Topic created **before** the flag was turned off
  keeps resolving via its existing read query after the flag flips off.
- Content with no `tenantSlug` (default site, or not-yet-tenanted) is unaffected by any flag —
  every one of the five mutations still succeeds there exactly as today.
