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
