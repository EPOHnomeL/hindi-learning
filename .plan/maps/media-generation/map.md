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
  are not. Every ticket here hits that wall, and answering it once for all three is the whole
  reason this is one map.
- **The audiences genuinely differ and must not be collapsed:**
  [the trailer](tickets/01-scope-course-trailer.md) is marketing, outward, per-course,
  generated from course data; [course audio](tickets/02-scope-course-audio.md) is pedagogy,
  inward, per-lesson, learner-consumed; [the demo](tickets/03-scope-onboarding-and-marketing-video.md)
  is hand-authored product marketing aimed at a stranger who has no account yet.
- **The cheapest branch for two of the three is "not a video file at all."** The course
  already carries structured ingredients for a template-driven motion *page* (title, Emblem,
  Mission, lesson list, lesson count, languages), and the `html-demo-wizard` skill builds
  standalone high-fidelity HTML demos. Establish deliberately whether an mp4 is ever needed —
  WhatsApp and social want a file; a landing-page embed does not.
- **Whitelabel decides whether each of these is one build or four.** A tenant's trailer and a
  tenant's demo must look like that tenant — one artifact reading `tenants.theme`, or
  hand-authored per tenant like `src/app/_landing/registry.ts`.
- **Staleness is the honest risk on 03.** A hand-authored demo drifts from the real UI
  silently; a guided tour over the real app is the always-current alternative and should be
  priced, not dismissed.
- **This map *generates* media; [rich-media](../rich-media/map.md) *ingests and serves* it.**
  Same provider split, opposite direction — keep the seam.
- Skills: `/grilling`, `/prototype` (a template-render spike is cheap and decisive),
  `html-demo-wizard`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether audio multiplies per Edition.** Named in ticket 02; the real answer depends on the
  funding decision in
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).

## Out of scope

- Paid-ads and distribution tooling.
- Video renderings of lesson content, media upload and embedding —
  [rich-media](../rich-media/map.md).
- **Actually building any of it** — this map's deliverable is the decision set.
