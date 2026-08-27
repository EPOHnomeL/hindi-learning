---
type: task
blocked_by: [07, 09]
---
# Wire PostHog into the app, browser and the ITN handler

> `/wayfinder .plan/maps/ui-overhaul/tickets/10-wire-posthog.md`

## Question

The build. It decides nothing; it exists so ticket 13 has data to decide from.

Two SDKs, deliberately. **`posthog-js`** in the browser for pageviews, autocapture
and replay. **`posthog-node`** in the Convex `/payfast/notify` ITN handler for
`purchase_completed`, because purchase truth lands server-side and asynchronously and
a browser-only event under-counts sales. At around ten lifetime sales, missing two is
a large fraction of the evidence.

**Ticket 11 must be live in prod before replay is switched on there.** Nothing
structural enforces it, because the wiring ships fine with replay off. Build freely,
enable replay after 11.

## Todo

- [ ] Bootstrap `posthog-js` near `ConvexClientProvider`, API host
      `https://eu.i.posthog.com`, masking exactly as ticket 09 specifies.
- [ ] `identify()` on sign-in with the **Convex user id only**, aliasing the prior
      anonymous id so pre-account and post-account sessions stitch.
- [ ] Add `posthog-node` to `convex/http.ts` plus `convex/payfast.ts`, firing
      `purchase_completed` on the **accepted** ITN path only, on the same distinct id.
- [ ] Client key as a `NEXT_PUBLIC_` var in `env.js`; server key in `convex/env.ts`.
      Do not cross them (known footgun, see project-context).
- [ ] Hand the user the exact `.env` lines to add. Never edit `.env`.
- [ ] Watch one of your own sessions back and verify the masking holds.
- [ ] Confirm browser and ITN events land on the same person in the EU project.

## Notes

Per-tenant subdomains use host-only cookies, so each subdomain gets its own PostHog
device id. That is expected; `tenant` on the event is what reunites them.

## Done when

Both sources are visible in the EU project and stitch to one person, replay is
recording with ticket 09's masking verified by watching your own session, and the
Answer records the env var names and where the bootstrap lives. Replay in prod stays
off until 11 has shipped.
