# Media generation

<!-- Charted 2026-08-01 by consolidating the course-media map and the single-ticket
     onboarding-video map, which were charting the same wall from two sides. Each ticket
     carries the context its old map held, folded in under a "Context folded from"
     heading. This map is an INDEX, not a store. -->

## Destination

Three "make us a video/audio artifact" asks decided against one shared rendering reality: the
per-course **trailer**, learner-facing **course audio**, and the product **onboarding /
marketing demo** — each ending in an approach, lifecycle and format spec, not a built renderer.

## Notes

- **What unifies these three is the constraint, not the audience:** Convex actions cannot run
  ffmpeg. TTS and transcript fetches are plain HTTP and fine; transcoding and video rendering
  are not.
  **Corrected 2026-08-06:** "every ticket here hits that wall" is not true, and reasoning from
  it wastes a session. The wall binds work that renders **at runtime, from course data** — the
  [trailer](tickets/01-scope-course-trailer.md) and
  [course audio](tickets/02-scope-course-audio.md). It does **not** bind
  [the demo](tickets/03-scope-onboarding-and-marketing-video.md), which is hand-authored and
  rendered locally at build time; a prototype walked on 2026-08-06 renders HTML → mp4 with
  Playwright + ffmpeg on a developer machine, never in a Convex action. The map still holds,
  but on the shared *audience/format* question, not on a constraint two of the three share.
- **Ticket 03's Mux choice is owed an ADR, and that is [ticket 04](tickets/04-adr-mux-as-the-video-rail.md)**
  — open as of 2026-08-18, and no Mux code exists on `main` yet (nothing under `src/` or
  `convex/` references it). The pointer lives here rather than in Decisions-so-far, which may
  only index resolved tickets.
- **The audiences genuinely differ and must not be collapsed:**
  [the trailer](tickets/01-scope-course-trailer.md) is marketing, outward, per-course,
  generated from course data; [course audio](tickets/02-scope-course-audio.md) is pedagogy,
  inward, per-lesson, learner-consumed; [the demo](tickets/03-scope-onboarding-and-marketing-video.md)
  is hand-authored product marketing aimed at a stranger who has no account yet.
- **The cheapest branch may be "not a video file at all."** The course already carries
  structured ingredients for a template-driven motion *page* (title, Emblem, Mission, lesson
  list, lesson count, languages), and the `html-demo-wizard` skill builds standalone
  high-fidelity HTML demos. Establish deliberately whether an mp4 is ever needed — WhatsApp
  and social want a file; a landing-page embed does not.
  **Settled for [the demo](tickets/03-scope-onboarding-and-marketing-video.md) 2026-08-07,
  the other way:** an mp4 *is* the deliverable and the HTML page is only the toolchain that
  renders it, because a stranger reads a self-driving page as a broken UI, and only a file
  travels on WhatsApp. Still genuinely open for
  [the trailer](tickets/01-scope-course-trailer.md).
- **Whitelabel decides whether each of these is one build or four.** A tenant's trailer and a
  tenant's demo must look like that tenant — one artifact reading `tenants.theme`, or
  hand-authored per tenant like `src/app/_landing/registry.ts`. **For the demo this is
  settled: `ywampotch` only** (2026-08-07), so it is one build, and the other three tenants
  are out of scope below.
- **Video hosting is Mux, product-wide** (decided 2026-08-07 in
  [the demo ticket](tickets/03-scope-onboarding-and-marketing-video.md), at full reach). That
  binds anything on this map that ends in a video file, and it closes the hosting half of
  [rich-media/01](../rich-media/tickets/01-video-and-audio-integration.md). It is **not yet
  provisioned** and it is owed an ADR —
  [ticket 04](tickets/04-adr-mux-as-the-video-rail.md).
- **Staleness on 03 was priced and accepted** (2026-08-07). The guided-tour-over-the-real-app
  alternative lost on a hard blocker, not on cost alone: two of the demo's nine beats are
  third-party redirects (Google OAuth, PayFast) that cannot be driven unattended, so a "real"
  recording would fake exactly the two persuasive moments — and the repo has no e2e harness
  and no course seeder to build it on. The video carries a recorded-on date and is treated as
  disposable marketing.
- **This map *generates* media; [rich-media](../rich-media/map.md) *ingests and serves* it.**
  Same provider split, opposite direction — keep the seam.
- Skills: `/grilling`, `/prototype` (a template-render spike is cheap and decisive),
  `html-demo-wizard`.

## Decisions so far

<!-- one line per resolved ticket -->

- [Scope the product onboarding + marketing video](tickets/03-scope-onboarding-and-marketing-video.md)
  — **decided, NOT built.** One artifact: the learner-path walkthrough already prototyped,
  shipped as a **Mux-hosted mp4 embedded on the YWAM Potch landing page**, `ywampotch` only.
  Pre-signup marketing to a stranger; signed-in first-run is not a video problem and stays
  with [onboarding](../onboarding/map.md). The mp4 is the deliverable and the HTML page is
  the toolchain, so the page moves out of `public/` (where it is currently served on all four
  tenant hosts). Drift is accepted and date-stamped: the guided-tour alternative is blocked by
  Google OAuth and PayFast, which cannot be driven unattended. **Mux was chosen at full reach
  as the product-wide video rail**, and that reach is what the ADR ticket carries.

## Not yet specified

- **Whether audio multiplies per Edition.** Named in ticket 02; the real answer depends on the
  funding decision in
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).

## Out of scope

- Paid-ads and distribution tooling.
- Video renderings of lesson content, media upload and embedding —
  [rich-media](../rich-media/map.md).
- **Actually building any of it** — this map's deliverable is the decision set. The demo's
  implementation ticket is therefore owed *outside* this map; 03 resolves as decided, not
  shipped.
- **Demo videos for `upf`, `almighty-warriors` and `yknot`** (2026-08-07). Only `ywampotch`
  has a bespoke landing page to embed one on and a diagnosed comprehension leak to fix. The
  other three get one when someone has a funnel problem to point at, by which time this one
  will have shown whether the format works. One accepted-stale artifact is a shrug; four is a
  pattern.
- **An owner-path demo and a signed-in first-run demo** (2026-08-07). Named together with the
  marketing demo when 03 was filed, ruled out on resolution: a signed-in user should be
  touching the real UI, not watching a cartoon of it, and that moment belongs to
  [onboarding](../onboarding/map.md). Note `public/editor-onboarding-demo.html` (committed
  2026-07-21, `3741ee9`) already exists as an owner-path artifact, unlinked from anywhere in
  `src/`; nothing further is planned for it here.
