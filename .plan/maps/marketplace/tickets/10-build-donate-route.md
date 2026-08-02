---
type: task
blocked_by: [03, 08]
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

## Answer

**Built and shipped 2026-08-02** (`feat(donations): give the rail its own /donate page…`).
`src/app/donate/page.tsx` is a server component outside the `(app)` group; it resolves the
slug, fetches the tenant, `notFound()`s unless `flags.donations`, and renders `<Brand/>` →
`<DonateSection/>` → `<SiteFooter/>`. Everything the spec decided landed as decided; the
notes below are the things a reader of the spec alone wouldn't know.

- **The gate does not reuse `getTenantView()`, and this was the one real trap.** That helper
  catches Convex errors and returns `null` on purpose ("a theme read is best-effort branding,
  never access control"). Correct for a palette, wrong for a gate: it would have made a
  transient Convex blip render as a 404 on a live donation page — a fault that looks exactly
  like a misconfigured flag and would have cost an operator hours. `/donate` calls
  `fetchQuery` directly so a failure surfaces as a 500.
- **The thank-you swap is uniform, not `/donate`-only.** `?donation=thanks` hides the widget
  wherever `DonateSection` renders, including the landing page. One branch instead of a
  prop threaded through two call sites, and it isn't wrong on the landing page either — a
  donor who just paid shouldn't be re-asked there either. No new i18n keys: the page header's
  brand link is the way onward, so nothing needed translating into five locales.
- **`DonateSection`'s own header comment was stale the moment this shipped** — it asserted
  "the anchor IS the requirement". Rewritten in the same commit to say the component now
  renders in two places and that the anchor is no longer load-bearing.

### Verified, and how — the distinction matters here

- **Walked (curl, dev server):** `/donate` on the apex → **404**; `/donate` on
  `ywampotch.localhost` → **404**, which *is* the gate working, because no tenant in the dev
  deployment has the `donations` flag on (checked all four: upf, ywampotch,
  almighty-warriors, yknot — absent on every one).
- **Test:** `convex/donations.test.ts` asserts both round-trip URLs exactly. 785 tests pass.
- **Build:** `pnpm build` clean; `/donate` registered as a dynamic route. This is what proves
  the server/client boundary — `SiteFooter` had only ever been rendered from client
  components before.
- **NOT walked: the happy path.** Nobody has seen this page render its widget. Doing so needs
  the flag on in dev, which needs a `donationPayee` who `isReadySeller` (the toggle refuses
  otherwise, by ADR 0027), i.e. mutating the operator's dev data — out of scope for a session
  that wasn't asked to. **Prod has the flag on for ywampotch** (that is why the bug was
  reported at all), so the first real render will be the post-deploy check.
