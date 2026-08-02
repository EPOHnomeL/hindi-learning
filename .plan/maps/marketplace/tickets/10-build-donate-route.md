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

  **⚠ A caution this ticket earned the hard way.** Mid-session I reported the flag as off in
  *production* too. That was wrong, and the reason is already written down in
  [project-context.md](../../../docs/agents/project-context.md): `.env.local` pins a **dev**
  `CONVEX_DEPLOY_KEY`, the env var **beats `--prod`**, and the CLI reads it from the file — so
  `convex run … --prod` and even `env -u CONVEX_DEPLOY_KEY convex run … --prod` both answered
  for dev while looking exactly like a prod answer. Prod is `capable-barracuda-769`; dev is
  `judicious-marmot-580`. The unambiguous read, when the deploy key is in play, is to bypass
  the CLI entirely:

  ```sh
  curl -s -X POST https://capable-barracuda-769.eu-west-1.convex.cloud/api/query \
    -H "Content-Type: application/json" \
    -d '{"path":"tenants:getTheme","args":{"slug":"ywampotch"},"format":"json"}'
  ```

  That returns `donations: true` — **prod has the flag and a payee set**
  (`ywampotchtpm@gmail.com`), which is what made the bug reportable in the first place.
- **Test:** `convex/donations.test.ts` asserts both round-trip URLs exactly. 785 tests pass.
- **Build:** `pnpm build` clean; `/donate` registered as a dynamic route. This is what proves
  the server/client boundary — `SiteFooter` had only ever been rendered from client
  components before.
### Walked on LIVE PRODUCTION, 2026-08-02, after deploy

Pushed to `main` (Vercel auto-deploys prod) and checked against the real thing:

| Check | Result |
|---|---|
| `ywampotch.my-course.app/donate` — flag **on** | **200** |
| `yknot.my-course.app/donate` — flag **off** | **404** — the gate working on real data |
| apex → `www.my-course.app/donate` — no tenant | **404** |
| prod `donations:checkoutFields` `return_url` | `https://ywampotch.my-course.app/donate?donation=thanks` |
| prod `cancel_url` | `https://ywampotch.my-course.app/donate` |
| $10 at rate 18.4 | `R184.00`, item `Donation to YWAM Potch` |

**The third break — a donor who paid and saw no acknowledgement — is structurally dead on the
live rail**, since the round-trip no longer depends on an anchor resolving.

### Still not seen by a human, and one thing worth a follow-up

`curl` proves the route, the gate and the signed fields. It cannot prove the **rendered
widget**, the scroll, the signed-in redirect or the thank-you swap: `DonateSection` is a
client component whose Convex queries resolve after hydration.

That last point is itself a finding: **`id="donations"` is absent from `/donate`'s
server-rendered HTML.** Not a regression — the landing section always behaved this way, and it
is *why* the anchor never worked — but alone on a dedicated page it shows as a brief empty gap
between header and footer before the widget appears. Worth fixing only if it looks bad in
practice, and the fix isn't free: the flag is already known server-side here, but
`donations.config` would also have to be fetched server-side and threaded in as props, which
means splitting the component. Deliberately not done in this ticket; recorded so whoever sees
the flash knows it is understood, not missed.
