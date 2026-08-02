---
type: task
blocked_by: [03, 08]
claimed_by: donate-route-session
claimed_at: 2026-08-02T09:52:32+02:00
---

# Build the `/donate` route

> `/wayfinder .plan/maps/marketplace/tickets/10-build-donate-route.md`

## Question

Make the donation rail reachable by a shared link. Build an ungated `/donate` route that
renders the existing `<DonateSection/>` on its own page, in either auth state, and move the
PayFast round-trip onto it.

Read [the spec](../spec-donate-route.md) first — it carries the diagnosis (both of the bug
report's suspected causes are wrong) and every decision below, with reasons. Grill rather
than invent where a detail isn't written there.

Scope, as decided:

- `src/app/donate/page.tsx`, **outside** the `(app)` group so it is ungated — the same
  posture as the `(legal)` group, which is the precedent this follows.
- Chrome: a thin tenant-branded header (`Brand`, linking home) plus the shared `SiteFooter`.
  The donor must have a way back into the site and visible branding, or an unfamiliar
  visitor reads a bare payment form as a phishing page.
- Gate: `notFound()` when this site's `donations` flag is off (or there's no tenant).
  **Do not reuse `getTenantView()`'s error-swallow** — it returns `null` on a Convex error
  by design ("a theme read is best-effort branding, never access control"), and a transient
  blip must not 404 a working donation page.
- `convex/donations.ts`: `returnUrl` → `/donate?donation=thanks`, `cancelUrl` → `/donate`.
  The `#donations` anchor comes off both — on a dedicated page there is nothing to scroll to,
  which is the point.
- `?donation=thanks` **replaces** the widget with the acknowledgement rather than banner-ing
  above it.

## Done when

- `<tenant>.my-course.app/donate` renders the donation widget signed in *and* signed out.
- A completed donation returns to a page that visibly acknowledges it, in both auth states.
- `/donate` 404s on a site with donations off, and does *not* 404 because Convex hiccuped.
- The landing section still renders where ticket 08 put it — this ticket adds a surface, it
  removes none.
- `pnpm test` and the type check pass; the Convex tests assert the new return/cancel URLs.
