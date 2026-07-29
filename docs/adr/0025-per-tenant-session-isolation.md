# Per-tenant session isolation

> Deliverable of [tenant-session-isolation](../../.scratch/tenant-session-isolation/HANDOFF.md)
> ([issue #119](https://github.com/EPOHnomeL/hindi-learning/issues/119)), grilled and
> agreed 2026-07-28. The spec reserved "ADR 0024"; by the time it was implemented that
> number had been taken by [0024](0024-publish-at-the-edition-grain.md), so this is 0025.

## Status

Accepted 2026-07-29. **Supersedes [ADR 0022 §4a](0022-tenant-subdomain-model.md)**
("One session (and device settings) across subdomains"), accepted eight days earlier.

## Context

Each whitelabel tenant is a brand on its own subdomain (`<slug>.my-course.app`), one
deployment, one Convex backend. ADR 0022 §4a decided that a single sign-in should span
every subdomain, and treated the host-locked session that preceded it as *"an
unintended artifact"* — a bug. Delivering that took a parent `Domain` on the session,
language and theme cookies, a `NEXT_PUBLIC_COOKIE_DOMAIN` knob, and a vendored
`@convex-dev/auth` patch swapping the `__Host-` cookie prefix (which forbids `Domain`)
for `__Secure-`. It charged every user one re-sign-in to ship.

In practice the operator needs the opposite. Running the platform means holding
**several accounts at once** — the default site as themselves, a tenant as that
tenant's admin or as a test learner — and a shared session makes that impossible in
one browser: signing into one brand signs you out of the other. Each brand should also
remember its own language and light/dark, because they are different products to the
people using them.

This reverses a decision only a week old. That was put to the user explicitly, with
the conflict named, and confirmed.

## Decision

**Sessions, app language and theme are scoped per tenant subdomain.** No cookie
carries a `Domain`; the browser's own host-only default does the isolating.

1. **A product change, not a test convenience.** Real isolation for end users, not a
   dev-only switch.
2. **Mechanism: host-only cookies.** Stop attaching `Domain` anywhere. This is almost
   entirely deletion — the `@convex-dev/auth` patch, `src/lib/cookieDomain.ts` and the
   `NEXT_PUBLIC_COOKIE_DOMAIN` env var all go, and the session returns to upstream
   `__Host-` defaults. No per-tenant cookie-naming scheme to get subtly wrong, and no
   patch to re-cut on every auth bump.
3. **The language and theme cookies are renamed** — `hindi_locale` → `hindi_lang`,
   `hindi_theme` → `hindi_mode`. This is load-bearing, not cosmetic: see Consequences.
4. **A cross-tenant shared course costs a sign-in per brand.** No session handoff, no
   interstitial. `AppGate` already renders sign-in *at* the deep-linked URL, so a
   bounced user signs in and lands on the course rather than a 404 — and Guest
   `/share/<token>` links stay fully unauthenticated, which is the common sharing path.
   Sign-up is open (ADR 0021), so isolation costs a credential re-entry and never an
   access denial.
5. **Recorded here** so §4a's "host-locked sessions are a bug" framing can't quietly
   undo it.

## Consequences

**Every existing user was signed out once on deploy**, and language and theme reset
once — language falls back to the `Accept-Language` sniff (usually right), theme to
light, so dark-mode users re-toggle. Accepted, and symmetric with what §4a itself
charged a week earlier.

**Why the rename is not optional.** Users hold `hindi_locale` and `hindi_theme` with
`Domain=my-course.app` and a year of max-age. A host-only cookie of the *same* name
does not replace a parent-domain one: the browser keeps **both** and sends both in one
header (`Cookie: hindi_locale=en; hindi_locale=hi`). `cookies.get()` returns whichever
is listed first — per RFC 6265, path length then creation time — so the stale shared
value can silently and permanently beat the tenant's own choice, and nothing ever
deletes it. New names make the collision structurally impossible. For the same reason
the auth cookie reverts to upstream `__Host-` rather than keeping `__Secure-` and
merely dropping `Domain`: `__Secure-` permits `Domain`, so the old parent-domain
session cookie would linger under the same name and keep being sent to every subdomain.
Reverting the prefix renames it, which is what guarantees the clean break.

**One account signing into two tenants still converges to one language.** `LocaleSync`
syncs `userPrefs.locale` — the deliberate cross-device *account* truth — over the
cookie at every login, and cookie isolation doesn't touch that. With different accounts
per tenant (the actual goal) each carries its own locale, so this is invisible. Only if
one account must read different languages per brand does `userPrefs.locale` need keying
by tenant slug; not built (YAGNI). **Theme is unaffected** — it is cookie-only, with no
account-level row.

**Local dev looks the same as before.** `<slug>.localhost:3000` was always host-only,
so isolation is the existing local behaviour; reproducing the *old* shared behaviour
would have required setting the env var locally.

**`hindi:*` localStorage** (Edition language, answers-seen, guest progress) is
per-origin already, so it isolated for free.

**The tenant catalogue is unaffected and now more coherent:** it scopes on the browsed
host too (ADR 0024 §6, as amended), not on any account field.
