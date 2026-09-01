---
type: grilling
blocked_by: []
---

# Scope the product onboarding + marketing video (html-demo-wizard)

## Question

## Why

Requested 2026-07-29 alongside the ywampotch launch scoping
(`.plan/maps/ywampotch-launch/PRD.md`), and explicitly deferred out of that block.

Two funnel leaks were diagnosed for ywampotch: **checkout abandonment** and
**sign-up friction**. The launch work attacks the mechanical half (Google sign-in,
a manual EFT rail, brand continuity). It does not attack the *comprehension* half
— a visitor landing on a tenant subdomain has no fast way to see what the product
actually does before being asked to sign up and pay. A short demo is the cheapest
answer to that.

The named tool is the **`html-demo-wizard` skill**, which builds standalone
high-fidelity HTML product demos and autoplay user-flow simulations. That is a
material constraint on the whole shape: the likely deliverable is an *interactive
page*, not an mp4.

## Not to be confused with

- **#62 course-media/01 (course trailer)** — a *per-course* marketing artifact
  **generated from course data** (title, Emblem, Mission, lesson list) for an
  owner to share. This issue is a *product* demo, hand-authored once, showing the
  platform itself. Adjacent, different generator, different lifecycle. Whoever
  scopes either should read both, because a shared rendering approach may fall
  out of it.
- **#63 course-media/02 (course audio)** — learner-facing, not marketing.
- **#46 (Improve Onboarding Flow)** — the in-product first-run experience. This is
  the pre-signup pitch.
- **#77 landing-page/02** — featuring the paid marketplace on the landing page.
  A demo would plausibly *live* on a landing page, so these two interact.

## Questions to answer

- **Audience and moment.** Anonymous visitor on a tenant landing page, or
  signed-in first-run, or both? These want different lengths and different
  endings (one ends in "sign up", the other in "start lesson one").
- **Onboarding vs marketing — one artifact or two?** They were named together but
  they are different jobs: convincing a stranger vs orienting a new account. If
  one artifact must do both it will do neither well; decide deliberately.
- **Which flow does it show?** The learner path (find a course → read a lesson →
  answer a quiz → certificate) or the owner path (seed a Topic → the Routine
  authors → publish → sell)? For ywampotch specifically the learner path is the
  pitch; for selling the platform to a *tenant*, it is the owner path.
- **Interactive page or video file?** `html-demo-wizard` produces the former.
  Establish whether a real mp4 is ever needed (WhatsApp and social distribution
  want a file; a landing-page embed does not). Note the provider-split constraint
  from [Scope the course trailer](01-scope-course-trailer.md) — Convex actions cannot run ffmpeg.
- **Whitelabel.** Must a YWAM Potch demo look like YWAM Potch? If yes, is it one
  demo reading the tenant palette (`tenants.theme`, SSR-applied), or hand-authored
  per tenant like the landing pages in `src/app/_landing/registry.ts`? This is the
  question that decides whether it is one build or four.
- **Where it is hosted and how it ships.** In-repo route, or a standalone artifact
  hosted elsewhere? Does it deploy with the app or independently?
- **Staleness.** A hand-authored demo drifts from the real UI silently. What is
  the plan when the reader chrome changes — accept the drift, or is there a
  cheaper always-current option (a guided tour over the real app)?

## Out of scope

- Per-course generated trailers ([Scope the course trailer](01-scope-course-trailer.md)).
- Any paid-ads or distribution tooling.
- Actually building it. This ticket's deliverable is the decision set.

## Deliverable

Answers to the questions above, and a call on interactive-page vs video file —
enough to open implementation tickets under `.scratch/<feature>/issues/` per the
tracker split (`docs/agents/issue-tracker.md`).

## Done when

The audience/moment, one-artifact-or-two, which-flow, interactive-page-vs-video, whitelabel, hosting, and staleness questions are all answered — enough to open implementation tickets.

<!-- Migrated 2026-07-30 from GitHub issue #120 (filed 2026-07-29), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `onboarding-video` map (2026-08-01)

<!-- was .plan/maps/media-generation/tickets/03-scope-onboarding-and-marketing-video.md; that single-ticket map was consolidated into media-generation -->

- **The named tool is a material constraint:** the `html-demo-wizard` skill builds standalone
  high-fidelity HTML demos and autoplay flow simulations. That biases the deliverable toward
  an *interactive page*, not an mp4 — establish deliberately whether a real file is ever
  needed (WhatsApp and social want a file; a landing-page embed does not). Convex actions
  cannot run ffmpeg.
- **Onboarding and marketing are different jobs** — convincing a stranger vs orienting a new
  account. This ticket insists that be decided deliberately: one artifact doing both will do
  neither well.
- **The whitelabel question decides whether this is one build or four:** must a YWAM Potch
  demo look like YWAM Potch? One demo reading `tenants.theme`, or hand-authored per tenant
  like `src/app/_landing/registry.ts`.
- **Staleness is the honest risk.** A hand-authored demo drifts from the real UI silently. A
  guided tour over the real app is the always-current alternative and should be priced, not
  dismissed.
- Deliberately distinct from three neighbours:
  [Scope the course trailer](01-scope-course-trailer.md) (per-course, generated from course
  data), [Scope course audio](02-scope-course-audio.md) (learner-facing), and
  [Improve onboarding flow](../../onboarding/tickets/01-improve-onboarding-flow.md)
  (in-product first run). A shared rendering approach may still fall out of the trailer work.
- Skills: `html-demo-wizard`, `/grilling`, `/prototype`.
- **Out of scope:** paid-ads or distribution tooling; **actually building it** — the
  deliverable is the decision set.

---

## Prototype walked 2026-08-06 — evidence for four of the seven questions

A full learner-path demo was built with `html-demo-wizard` and rendered to video, as a
**prototype to answer this ticket**, not as the shipped artifact. Ticket stays open:
three questions below are still unanswered, and they are the ones that decide the build.

Artifacts (in the working tree, uncommitted as of writing):
[`public/ywampotch-walkthrough-demo.html`](../../../../public/ywampotch-walkthrough-demo.html)
and [`scripts/record-demo.mjs`](../../../../scripts/record-demo.mjs).

**Answered by walking it:**

- **Which flow → the learner path**, and it holds up: YWAM Potch landing → Google sign-in
  → dashboard → lesson 1 as the free Preview → paygate on lesson 2 → checkout page →
  PayFast → unlocked. Nine beats, **~50s** of footage. Long enough to tell the story,
  short enough for a landing-page embed.
- **Interactive page vs video file → both, and the page is the source.** The HTML page
  *is* the storyboard; the mp4 is a render of it, so there is no second sequence to
  maintain. `scripts/record-demo.mjs` drives a real Chromium via Playwright and emits
  WebM + H.264 MP4 in one command.
- **The ffmpeg constraint does not bind here.** This map's unifying wall is "Convex
  actions cannot run ffmpeg" — but this artifact is hand-authored and rendered
  **locally/at build time**, never at runtime from course data. The wall is real for
  [the trailer](01-scope-course-trailer.md), which is generated per-course; it does not
  constrain this ticket at all. That distinction should be reflected in the map's Notes.
- **Whitelabel is cheaper than feared — for the styling.** The tenant palette is applied
  as CSS custom properties, so re-skinning to another tenant is a variable swap, not a
  rebuild. But the *content* (course title, lesson names, price, landing copy) is
  hand-authored per tenant. So: **one build for four tenants only if the demo is
  data-driven**; hand-authored means four. That is the real fork, and it is narrower
  than "one build or four" implied.

**Still open — these decide the build:**

- **Audience/moment** and **onboarding vs marketing, one artifact or two.** The prototype
  is a *marketing* demo aimed at a stranger. It says nothing about the signed-in
  first-run case.
- **Hosting/shipping.** The prototype sits in `public/` and deploys with the app, which
  was convenient, not decided.

**Staleness is confirmed as the real risk, with a number.** Building against the live
components, the demo was wrong about the dashboard **twice in one session** — invented
card thumbnails that don't exist, and put the course under "Your courses" when a new
buyer actually sees it under "Available courses" with a price badge. Both were caught
only by reading `Dashboard.tsx`. A hand-authored demo drifts *immediately*, not
eventually. Price the guided-tour-over-the-real-app alternative seriously before
committing to hand-authoring four of these.

**Unrelated product bug found while building** (belongs to whoever owns the dashboard,
not to this map): `emptyLibrary` at `src/app/_components/Dashboard.tsx:106-115` ignores
the catalogue, so a new tenant learner sees "No courses yet — a marketplace is coming
soon" rendered directly above a live "Available courses" section containing a buyable
R100 course. **Filed 2026-08-07** as
[Dashboard empty state contradicts the catalogue below it](../../onboarding/tickets/03-dashboard-empty-state-ignores-catalogue.md);
re-verified live in that session, and the onboarding map's "already shipped, different
audience" out-of-scope line corrected in the same edit.

## Answer

**Decided 2026-08-07, NOT built.** One demo ships: the learner-path walkthrough already
prototyped, as a **Mux-hosted mp4 embedded on the YWAM Potch landing page**. Nothing below
is implemented; building it stays out of this map's scope, so the implementation ticket is
owed elsewhere.

- **One artifact, not two.** The learner-path walkthrough is the whole deliverable. No
  owner-path demo and no signed-in first-run demo. Signed-in first-run is not a video
  problem and stays with
  [Improve onboarding flow](../../onboarding/tickets/01-improve-onboarding-flow.md): a user
  who already has an account should be touching the real UI, not watching a cartoon of it.
- **Audience and moment: the pre-signup stranger** on the YWAM Potch landing page. This is
  marketing, aimed at the comprehension half of the funnel leak that
  [ywampotch-launch](../../ywampotch-launch/map.md) left unattacked.
- **Which flow: the learner path**, validated by walking the prototype. Nine beats, ~50s:
  landing → Google sign-in → dashboard → lesson 1 as the free Preview → paygate on lesson 2
  → checkout → PayFast → unlocked.
- **Interactive page vs file: a file.** The mp4 is the deliverable; the HTML page is the
  **toolchain** that produces it, not a surface a visitor ever meets. A stranger reads a
  self-driving HTML page as a UI that is not responding to their clicks; they read a video
  as a video. A file is also the only form WhatsApp and social can carry, which was the
  original reason to want one.
- **Hosting: Mux** — see the rail decision below. The HTML source **moves out of `public/`**
  (proposed `demos/`): anything in `public/` is served on every tenant host, so both demo
  pages are currently live and unlinked on `upf`, `almighty-warriors` and `yknot`, which have
  nothing to do with them. `.tmp/` stays the render scratch and stays gitignored; no mp4 is
  committed.
- **Whitelabel: `ywampotch` only.** It is the only tenant with a bespoke landing page
  (`src/app/_landing/registry.ts`) and the only one with a diagnosed comprehension leak. The
  palette is CSS custom properties so a re-skin is cheap, but the *content* is hand-authored,
  and with drift accepted (below) a data-driven demo has lost its main justification. The
  other three tenants are ruled out of scope on the map.
- **Staleness: accept the drift, date-stamp the video.** No manifest, no CI gate, no
  recording harness.

**The guided-tour-over-the-real-app alternative was priced, and it lost on a reason this
ticket did not anticipate.** Verified 2026-08-07: the repo has **no e2e harness at all** (no
`playwright.config.*`, no `e2e/`, `playwright` is a dependency only because
`scripts/record-demo.mjs` uses it) and **no course seeder** (`scripts/seed-tenants.ts` seeds
tenants, nothing else). Decisively, **two of the nine beats are third-party redirects**:
Google OAuth and PayFast cannot be driven unattended. A tour of the real app would have to
stub exactly the two moments carrying the most persuasive weight, so it would be a partly
faked film *and* cost a harness plus a seeder plus two provider stubs. Hand-authoring stays
cheaper and is no less honest.

**Also verified while resolving** (facts the ticket predates):
`scripts/record-demo.mjs` is already generic (`--page`, `--out`, `--fps`, `--audio`), so it
is a reusable renderer rather than a one-off; its deterministic virtual-clock mode is
**broken in this environment** and documented as such at `scripts/record-demo.mjs:41-47`, so
realtime is the working default and nobody should promise a judder-free render without
fixing it first.

### Mux is the product-wide video rail

Chosen here deliberately and at full reach, not just for this clip: **all product video,
including learner-facing course video, goes to Mux.** This settles the hosting half of
[Video & audio integration](../../rich-media/tickets/01-video-and-audio-integration.md),
whose deliverable was exactly that comparison (Convex storage vs unlisted YouTube vs
Cloudflare Stream vs Mux vs R2+CDN); that ticket has been narrowed accordingly. The reach
was flagged during grilling and taken knowingly.

Because it reaches past this map, it is owed an ADR, which is
[Record the ADR: Mux is the product-wide video rail](../../technical-foundation/tickets/15-adr-mux-as-the-video-rail.md). Mux
is **not yet provisioned** — no account, no keys, no `mux` reference anywhere in
`package.json` or the env as of 2026-08-07.
