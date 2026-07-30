---
type: grilling
blocked_by: []
---

# Scope the course trailer (shareable promo video)

## Question

## Why

"Video for the course to share around" — resolved 2026-07-15 as a **marketing artifact**: a
short video showing off a course, for the owner to post/WhatsApp/embed, pairing with the
marketplace and landing page. The course already has rich structured ingredients for a
template — title, [[Emblem]], [[Mission]], lesson list, sample quiz, lesson count, languages.

## Questions to answer

- Generation approach, cheapest-first: (a) a **template-driven motion page** rendered from
  course data (HTML/CSS animation → recorded to video, or even a shareable animated *page*
  instead of a video file — does it even need to be an mp4?); (b) slideshow + TTS narration;
  (c) AI video generation (expensive, slow, hard to brand-control). Where's the
  quality/effort knee?
- If a real video file: what renders it (client-side canvas/MediaRecorder in the owner's
  browser? a server job? an external API)? The provider-split constraint (Convex actions
  can't run ffmpeg) applies — same issue as rich-media/08.
- Trigger & lifecycle: owner button? Auto at [[Completion]]? Regenerate when the course
  changes? Stored as a Hub blob and served like other media?
- Formats: 16:9 + 9:16 (stories/reels)? Length target (~30–60s)?
- Branding: tenant theme + logo (whitelabel/03) — a UPF course trailer must look UPF.
- Sharing mechanics: download vs hosted share URL with OG tags (a trailer page may do more
  marketing work than a file).

## Out of scope

- Learner-facing audio/podcast (ticket 02).
- Any paid-ads/distribution tooling.

## Deliverable

The generation-approach decision (with a spike if template-render is chosen), trigger +
lifecycle, and the format/branding spec.

## Done when

The generation-approach decision (with a spike if template-render wins), the trigger and lifecycle, and the format/branding spec.

<!-- Migrated 2026-07-30 from GitHub issue #62 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
