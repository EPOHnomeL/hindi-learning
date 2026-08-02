---
type: task
blocked_by: [07, 09]
---
# Wire PostHog into the app — browser and the ITN handler

> `/wayfinder .plan/maps/ui-overhaul/tickets/10-wire-posthog.md`

## Question

The build. A `task` ticket in the wayfinder sense — it decides nothing, it exists to
unblock the decision in ticket 13, which cannot be made without data.

**Hard precondition: ticket 11 (the privacy-policy disclosure) must have landed in
prod before session replay is enabled there.** Nothing structural enforces this —
11 does not block this ticket, because the wiring can be built and shipped with
replay off. Recording South African users before the policy discloses PostHog as an
operator and names the cross-border transfer is the weak point of the no-banner
stance. Build freely; enable replay only after 11.

Two SDKs, deliberately:

- **`posthog-js`** in the browser for everything UX — pageviews, autocapture,
  session replay. Bootstrapped near `ConvexClientProvider`; the API host is
  `https://eu.i.posthog.com`. `identify()` fires with the **Convex user id only** on
  sign-in, aliasing the prior anonymous id so the pre-account and post-account
  sessions stitch. Masking exactly as ticket 09 specifies.
- **`posthog-node`** in the Convex `/payfast/notify` ITN handler (`convex/http.ts` →
  `convex/payfast.ts`) for `purchase_completed`, on the **same distinct id**.
  Purchase truth lands server-side and asynchronously — the buyer may have closed
  the tab — so a browser-only purchase event under-counts real sales. At ~10
  lifetime sales, missing two is a large fraction of the evidence.

Wiring notes for whoever picks this up:

- The client key is a **`NEXT_PUBLIC_`** var in `env.js`; the server key goes in
  `convex/env.ts`. Do not cross them — project-context calls out that mixing a
  Convex-runtime var into `env.js` (or the reverse) is a known footgun here.
- `.env` is the user's file. Do not edit it — hand over the exact lines to add.
- The app is multi-tenant on per-tenant subdomains with **host-only cookies**, so
  each tenant subdomain gets its own PostHog device id. That is expected and
  correct; `tenant` on the event is what reunites them.
- Fire `purchase_completed` only on the **accepted** ITN path, not on every ITN
  received — `convex/payfast.ts` already encodes the acceptance rules.

## Done when

Events from both the browser and the ITN handler are visible in the EU project and
stitch to the same person; replay is recording with the ticket-09 masking verified
by watching one's own session; and the Answer records the env var names and where
the bootstrap lives. Replay in **prod** stays off until ticket 11 has shipped.
