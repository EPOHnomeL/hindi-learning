---
type: task
blocked_by: [07]
---
# Feature flag enforcement

## Question

Flags are only real if they're enforced server-side — the ticket was explicit that hidden buttons
aren't enough, since every flaggable feature has a Convex function a client could call directly.
Ground truth: 04's resolution decisions 2–4 and the worked example. Scope:

- New `assertTenantFlag(ctx, tenantSlug: string | undefined, flag: keyof TenantFlags)` in
  `convex/lib.ts`: no-ops when `tenantSlug` undefined (default site — every v1 flag implicitly on,
  no regression); else looks up the `tenants` row by `by_slug` and throws if `flags[flag]` isn't `true`.
- `getOwnedTopic`/`getViewableTopic`/`getEditableTopic` stay **flag-agnostic** — do not touch them.
  Call `assertTenantFlag` inline in each of the five create-side mutations: `claimCertificate`
  (`certificates`), `setTopicPublic`/`setEditionPublic` (`publicLinks`), `askQuestion` (`qa`),
  `startTranslation`'s `tryAcquireTranslation` (`translations`), `seedTopic` (`seeding`, tenant from
  the caller's own `tenantSlug`).
- Read paths untouched — that's what makes flag-off frozen-not-revoked.
- Client-side belt-and-suspenders is 21's concern.

## Done when

With a tenant's `certificates` flag false, `claimCertificate` for a Topic on that tenant throws
(verified by a direct mutation call in a test) — repeated for the other four flag×mutation pairs; a
grant created before a flag flips off keeps resolving via its read query; content with no
`tenantSlug` is unaffected by any flag.

## Answer

Built test-first (`/tdd`) and minimal (`/ponytail`), 2026-07-18. Shipped in commit `9ffbb48`.

**Helper** — `assertTenantFlag(ctx, tenantSlug, flag)` in `convex/lib.ts`: no-ops when `tenantSlug`
undefined, else reads the `tenants` row by `by_slug` and throws unless `flags[flag]` is `true`.
Fail-closed on an unknown slug. `TenantFlag` is derived from the schema's `tenantFlagsValidator` so
the keys can't drift.

**Five create-side call sites** (each `await assertTenantFlag(...)`, inline):
- `claimCertificate` (`certificates.ts`) — `certificates`, tenant from the resolved Topic. Placed
  **after** the idempotent existing-cert return, so a cert earned before the flip keeps resolving.
- `setTopicPublic`/`setEditionPublic` (`shares.ts`) — `publicLinks`, only when `isPublic === true`;
  revoking a link stays allowed.
- `askQuestion` (`capture.ts`) — `qa`.
- `tryAcquireTranslation` (`translate.ts`) — `translations`; throws (rather than returning a reason)
  so a disabled feature surfaces as an error like the rest.
- `seedTopic` (`content.ts`) — `seeding`, tenant from the caller's own `user.tenantSlug` (no Topic
  yet at creation).

Read paths (`myCertificate`, `myQuestions`, the Editions link display, etc.) left untouched.

**Tests** — `convex/lib.test.ts`: the helper (no-op / on / off / fail-closed) plus each of the five
mutations throwing when off and succeeding both on-tenant and on the default site, and the
frozen-read case. 15 pass; typecheck clean; existing suites for the five touched files green (97 pass).
Browser check pending (needs an authed tenant session dev can't fully supply), as with 11/13/19.
