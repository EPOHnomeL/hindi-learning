# Course media

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Two generation decisions with their costs understood: the **course trailer** (a marketing
artifact an owner shares) and **course audio** (learner-facing study listening). Both end in
an approach + lifecycle + format spec, not a built renderer.

## Notes

- **The two tickets pull in opposite directions** and must not be collapsed: 01 is
  *marketing*, outward, per-course, owner-triggered; 02 is *pedagogy*, inward, per-lesson,
  learner-consumed.
- **The provider-split constraint decides half of ticket 01:** Convex actions cannot run
  ffmpeg. TTS is plain HTTP and so is action-compatible; video rendering is not. Confirm this
  before choosing an approach.
- The course already carries rich structured ingredients for a template — title, Emblem,
  Mission, lesson list, sample quiz, lesson count, languages. Ticket 01's cheapest branch is
  a template-driven motion *page*, which raises the honest question of whether an mp4 is
  needed at all.
- Branding: a tenant's trailer must look like that tenant (whitelabel theming) — this is what
  turns "one build" into "four".
- **Not the same as**
  [onboarding-video/01](../onboarding-video/tickets/01-scope-onboarding-and-marketing-video.md):
  that is a hand-authored *product* demo. Whoever scopes either should read both — a shared
  rendering approach may fall out.
- Skills: `/grilling`, `/prototype` (a template-render spike is cheap and decisive).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether audio multiplies per Edition.** Ticket 02 names it; the real answer depends on
  the funding decision in
  [paid-marketplace/01](../paid-marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).

## Out of scope

- Paid-ads or distribution tooling.
- Video renderings of lesson content — that's [rich-media](../rich-media/map.md).
