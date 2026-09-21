---
type: task
blocked_by: []
---
# A repeatable Lighthouse run, and the baseline every other ticket is measured against

## Question

**There is no Lighthouse harness in this repo.** `grep -ri lighthouse` over the tree on
2026-09-21 hits only `.next/` build artefacts (Next's own `htmlLimitedBots` regex) and
an unrelated skill description. So "optimise for a great Lighthouse score" currently has
no number in it, for any route, ever.

Every other ticket on this map claims to move a score. Without this one they each
resolve on "it should score better" rather than "it does", which is precisely the
distinction CLAUDE.md insists on. That is why all six are blocked by this ticket, and
why this is a prefactor rather than a fix: make the change easy, then make the easy
change.

Two things are already settled by the human at charter (2026-09-21) and are **not** to
be re-litigated in this session:

- **The target is a Vercel preview URL.** Not a local `next start`. Brotli, the CDN and
  the Vercel image optimizer exist only on the deploy, and a local build's absolute
  numbers read pessimistically enough to mislead. The harness takes a base URL so a
  preview, production or a tenant host can each be pointed at.
- **Four URLs, all ungated:** `/` signed out, `/terms`, `/privacy`, `/refunds`. No
  authenticated run, no cookie injection. Everything behind `AppGate` is client-rendered
  against Convex and scores a skeleton.

What to get right rather than guess:

- **Signed out means signed out.** `/` serves the Landing only to an unauthenticated
  visitor; signed in it is the Dashboard at the same URL, no redirect
  (`src/app/page.tsx`). A run that carries a session cookie scores the wrong page
  entirely and the report will not say so. Assert on something Landing-only before
  trusting a score.
- **The browser.** `playwright` is already a devDependency, so its Chromium is on disk
  and needs no new download. Prefer it to a second browser install.
- **Mobile, and say so.** Lighthouse's default preset is mobile with CPU and network
  throttling, and it is the right one here: the product's audience is mid-range Android
  phones on South African mobile data. Record which preset produced the baseline, since
  a desktop number is not comparable and someone will otherwise quote one at the other.
- **Run-to-run noise.** A single Lighthouse run against a URL over a real network is
  not a stable number. Establish how much it moves before ticket 07 tries to put a
  floor under it.

The baseline is the deliverable, not the script. It goes under the map's `assets/`
alongside the report JSON, and it is the "before" that tickets 02 to 06 each quote.
Capture it **before** any of them lands, because once 02 ships the comparison is gone.

## Done when

- One documented command produces Lighthouse reports for all four URLs against a given
  base URL, using Playwright's Chromium, without touching port 3000.
- The four category scores per URL are written into the Answer **and** into a dated
  asset under `../assets/`, with the raw report JSON committed beside it.
- The Answer states the Lighthouse version and preset used, and how much the scores
  moved across repeated runs of the same URL.
- The Answer confirms, with how it was checked, that `/` was scored signed out and
  rendered the Landing rather than the Dashboard.
- The Answer lists which specific audits failed per URL, since that list is what tickets
  02 to 06 are scoped against and a category score alone does not name them.
