---
type: task
blocked_by: [03]
---

> `/wayfinder .plan/maps/media-generation/tickets/04-adr-mux-as-the-video-rail.md`

# Record the ADR: Mux is the product-wide video rail

## Question

[Scope the product onboarding + marketing video](03-scope-onboarding-and-marketing-video.md)
chose **Mux** on 2026-08-07, and chose it at full reach: all product video, including
learner-facing course video, not just the one marketing clip. That reach settles the hosting
half of [Video & audio integration](../../rich-media/tickets/01-video-and-audio-integration.md),
whose own stated deliverable was that exact comparison.

A decision that closes another map's ticket and sets the cost basis for hours of course
video does not belong buried in a demo ticket's `## Answer`. Write it up as an ADR under
`docs/adr/`, per the repo's decisions convention.

Nothing here re-opens the choice. The decision is made; this ticket is the writing down of
it, honestly, including the parts that were *not* weighed.

## Done when

An ADR exists under `docs/adr/`, numbered per the directory's convention, that records:

- **The decision**: Mux hosts all product video, marketing and learner-facing alike.
- **The alternatives it displaces**, named from
  [rich-media/01](../../rich-media/tickets/01-video-and-audio-integration.md): Convex file
  storage, unlisted YouTube, Cloudflare Stream, R2 + CDN with a client-side `<video>`.
- **What actually drove it** — stated plainly: momentum toward doing video properly, decided
  on the strength of one ~50s marketing clip. The paid-marketplace economics that
  rich-media/01 wanted weighed (50/50 on net, a course carrying hours of video) were **not**
  costed before choosing. An ADR that pretends otherwise is worthless later.
- **The unlock criterion for revisiting**: what per-minute or egress number, at what course
  length, would make this the wrong call.
- **Consequences**: Mux needs provisioning (no account, no keys, no `mux` in `package.json`
  or the env as of 2026-08-07); a second rail for the same media type is now a regression,
  not an option.
