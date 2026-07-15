# rich-media/05: Scope transcription fallback for caption-less video

**Status:** open
**Depends on:** 04

## Why

Some videos have no captions at all; grounding then needs audio → text (speech-to-text). This
is a genuinely different component from caption fetching — an external STT service with real
per-hour cost, an audio-extraction step, and its own failure modes. Per the gated-phases
philosophy, the first question is whether to build it at all yet.

## Questions to answer

- **Defer entirely?** What fraction of the videos we actually expect (Hindi-learning content,
  lecture recordings) lack captions? If small, v1 answer may be "unsupported — tell the owner
  to pick a captioned video or upload a transcript". Define the demand signal that unlocks
  building it.
- If built: which STT service (Whisper-class API) and cost per audio-hour? Hindi/multilingual
  accuracy matters for this app specifically.
- Audio extraction: yt-dlp from the Routine's environment hits the same datacenter-IP blocking
  as ticket 04 — and pulling audio (not just captions) leans harder on YouTube ToS. Take an
  explicit position.
- Output must land in the *same* `processed` manifest shape agreed in ticket 04, so ticket 07
  never cares which path produced the transcript.

## Out of scope

- Anything for videos that *have* captions (ticket 04).

## Deliverable

A build/defer decision with the unlock criterion; if build, the service choice, cost estimate,
and where it runs.
