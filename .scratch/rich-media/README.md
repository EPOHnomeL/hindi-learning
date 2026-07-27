# rich-media — scoping tickets

Umbrella for two related asks (2026-07-14):

1. Ingest **images/posters, YouTube links, and video** as [[Resource]]s alongside PDF/markdown.
2. **Video-anchored courses**: a Topic built on a video + transcript, where the teach skill
   grounds lessons in the transcript and each video segment is released as the learner
   demonstrates understanding of the previous one (riding the existing Frontier gate).

These are **scoping tickets**, not implementation tickets — each covers one component and its
deliverable is answered questions + a recommendation, feeding a PRD (and likely an ADR or two)
before any build. No PRD exists yet by design.

## Tickets

| # | Ticket | Component |
|---|--------|-----------|
| 01 | [Image & poster Resources](issues/01-scope-image-poster-resources.md) | Upload surface (dashboard/reader) |
| 02 | [Media embedded inside Lessons](issues/02-scope-media-embedded-in-lessons.md) | Content blob route + publish path |
| 03 | [YouTube-link Resources & player embed](issues/03-scope-youtube-link-resources-and-embed.md) | Reader + lesson asset component |
| 04 | [Transcript ingestion](issues/04-scope-transcript-ingestion.md) | Routine lazy-ingestion |
| 05 | [Transcription fallback (no captions)](issues/05-scope-transcription-fallback.md) | STT service (likely deferred) |
| 06 | [Hosting rail for uploaded video files](issues/06-scope-uploaded-video-hosting-rail.md) | Storage/hosting decision (ADR) |
| 07 | [Video-anchored teach mode](issues/07-scope-video-anchored-teach-mode.md) | Teach skill / AUTHORING.md |
| 08 | [Ingestion across provider paths](issues/08-scope-provider-path-ingestion.md) | Routine vs OpenRouter runtime |
| 09 | [Editions × embedded media](issues/09-scope-editions-embedded-media.md) | Translate pipeline |
| 10 | [AI linking into Resources](issues/10-scope-resource-deep-linking.md) — **resolved** | Citations → owned Resources (whole-resource; anchors deferred) |
| 11 | [Implement Resource links](issues/11-implement-resource-links.md) — **ready-for-agent** | materialise + reader interceptor + skill guidance |
| 12 | [Book screenshots + direct references](https://github.com/EPOHnomeL/hindi-learning/issues/108) — **GitHub #108** | Screenshot-derived images (01/02) + page-level book references (extends 10) |

Rough dependency order: 01–03 are independent; 04 → 05, 07, 10; 03 → 07, 09; 02 → 09.
06 and 08 are decisions that shape everything downstream but can be scoped in parallel. 12 depends
on 01, 02, and 10.
