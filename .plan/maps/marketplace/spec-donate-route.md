# A dedicated `/donate` route — PRD

**Filed 2026-08-02** from a bug report against the live YWAM POTCH app, grilled the same
day. Scope: make the donation rail *reachable*. Nothing here reopens
[ADR 0027](../../../docs/adr/0027-per-tenant-donation-rail.md)'s money decisions — merchant
of record, the 10% split, USD-typed/ZAR-charged, the Guest donor and the no-intent-table
shape all stand unchanged.

## The report, and why both of its guesses were wrong

> **Signed out:** clicking the donation link opens the home page, but doesn't scroll to the
> donation section. **Signed in:** clicking the link redirects to the courses home page
> instead of the donation section.
>
> Possible causes: auth routing is overriding the link destination; scroll anchor/ID isn't
> hooked up correctly.

Neither cause is real, and saying so matters because both would have sent a fixer to the
wrong file.

- **The anchor is fine.** `DonateSection` renders `<section id="donations" className="scroll-mt-8">`
  — correct id, correct scroll offset.
- **Nothing redirects.** `src/app/page.tsx` serves `/` at one URL for both auth states and
  swaps `<Landing/>` for `<Dashboard/>`, deliberately and by its own comment ("same URL, no
  redirect"). It is auth-conditional *content*, not auth routing.

The actual root cause is single, and it explains both symptoms plus a third nobody reported:
**`DonateSection` is not in the document at the moment the browser acts on the hash.**

1. **Signed out** — `page.tsx` renders `<DashboardSkeleton/>` during `AuthLoading`, and
   `DonateSection` returns `null` until *both* the tenant flags and `donations.config`
   resolve. The browser looks for `#donations`, finds nothing, and never retries.
2. **Signed in** — `<Dashboard/>` contains no donation section at all, so there is nothing to
   find in any timeframe. This is already on the record: ticket 08's Answer ends
   *"`/` is the Dashboard when signed in, so a logged-in operator cannot see their own donate
   section."* The bug report is that limitation being met by a real user.
3. **Unreported, and the most damaging** — `convex/donations.ts` sets
   `returnUrl: appUrl("/?donation=thanks#donations", tenantSlug)`. A donor who **completes a
   payment** comes back through the identical race, and the thank-you callout lives *inside*
   `DonateSection`. Signed out they land on the hero with the acknowledgement off-screen;
   signed in they get the Dashboard and no acknowledgement exists. This is precisely the
   failure the comment above that line was written to prevent.

## Decision

**An ungated `/donate` route, coexisting with the landing section.** The section stays exactly
where ticket 08 placed it — automatically on the shared `<Landing/>`, by hand on bespoke
`YwamPotch.tsx` — and keeps doing its job as the passive ask for anyone scrolling the page.
`/donate` is the *linkable* surface: a URL that resolves to the widget in one hop, in either
auth state, with no anchor and no race.

| Question | Resolution |
|---|---|
| Replace the landing section? | **No — coexist.** `/donate` renders the same `<DonateSection/>`; the section stays on both landing pages |
| Chrome | Thin tenant-branded header (`Brand`, linking home) + shared `SiteFooter`, mirroring the `(legal)` group |
| Donations off for this site | **`notFound()`**, decided server-side from the tenant flags |
| PayFast round-trip | `returnUrl` → `/donate?donation=thanks`; `cancelUrl` → `/donate` |
| Thank-you | **Replaces** the widget — a donor who just paid is not re-asked |
| Legacy `#donations`, signed out | Scroll once the section actually mounts |
| Legacy `#donations`, signed in | `/` client-redirects to `/donate` |

### Why coexist rather than one canonical surface

Ticket 03 called the anchor *"the requirement"* — the operator shares
`<tenant>.my-course.app#donations`. That URL may already be in a WhatsApp message, an email
footer or a printed QR code, so it has to keep working; and removing the section from the
landing page would delete the passive ask, which is the only thing a visitor who *wasn't*
sent a donation link ever meets. Coexisting costs almost nothing: `/donate` is a thin shell
around a component that already exists.

### Why `notFound()` when the flag is off

It is the truth — on a site without donations, that page does not exist. It matches the
flag's existing fail-closed-by-absence posture, needs no new copy in five locales, and does
not advertise that donations are a platform feature to tenants who haven't enabled them.

**One trap, stated so the build doesn't fall in it:** `getTenantView()` deliberately swallows
Convex errors and returns `null`, because *"a theme read is best-effort branding, never access
control"*. Reusing that swallow for this gate would turn a transient Convex blip into a 404
on a working donation page. The gate must let a fetch failure surface, and 404 only on a
genuine flag-off.

### Why the thank-you replaces the widget

On a marketing page the thank-you was a callout partway down; a widget still being visible
below it was invisible in practice. Alone on `/donate` it is not: a donor who just gave money
being immediately re-asked reads as a broken page or a double-charge risk. Because ticket 03
chose no intent table, `?donation=thanks` is the *only* signal distinguishing a returning
donor from a fresh visitor — so it has to change what the page is.

## Deliberately not in scope

- **Payee-readiness in the page gate.** The gate checks the tenant flag only; live readiness
  needs a `QueryCtx`. Safe because decision 19 forbids switching the flag on without a ready
  payee, and `checkoutFields` re-checks readiness at the click. A payee revoked *after* the
  flag went on yields a page that errors on Donate rather than a 404 — same as today.
- **A less generic thank-you.** Still no intent table, so we still cannot tell a real
  returning donor from someone who typed `?donation=thanks`. Unchanged.
- **A superseding ADR.** ADR 0027's Decision says *"a flag-gated `#donations` section on the
  tenant landing page"*, and coexistence leaves that true. `/donate` adds a URL; it reverses
  no decision in 0027.
- **A `Donate` link in the landing nav or footer.** A separate design call about
  solicitation, not about reachability.

## Tickets

- [Build the `/donate` route](tickets/10-build-donate-route.md)
- [Fix the legacy `#donations` link in both auth states](tickets/11-fix-legacy-donations-anchor.md)
