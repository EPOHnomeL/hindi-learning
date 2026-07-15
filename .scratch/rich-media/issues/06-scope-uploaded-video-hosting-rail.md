# rich-media/06: Scope hosting rail for uploaded video files

**Status:** open
**Depends on:** —

## Why

Convex file storage will hold video bytes but is not a video pipeline: per-file upload limits
likely reject long recordings, there's no transcoding or adaptive streaming, and every reader
streaming from the Hub bills bandwidth. The working recommendation is **links-first, defer
uploads** — but that's a decision to record (likely an ADR), not assume.

## Questions to answer

- Verify the hard numbers: Convex per-file upload limit, range-request support on signed URLs
  (seek/scrub needs it), and storage + egress pricing at plausible video sizes. This kills or
  keeps the "just use Convex storage" option factually.
- External rails, cost/effort compared: unlisted YouTube (free hosting + captions, owner does
  the upload, ToS questions for a paid product), Cloudflare Stream, Mux, R2 + CDN with
  client-side `<video>`. Which fits the paid-marketplace economics (50/50 on net) when a
  course carries hours of video?
- What's the **demand signal** that unlocks building uploads at all? (Gated-phases: someone
  who can't use a link.) Until then, is "upload your video to YouTube unlisted and paste the
  link" an acceptable documented workflow?
- If a rail is chosen later: where do transcripts come from for uploaded files (no YouTube
  captions — forces ticket 05)?

## Out of scope

- YouTube-link handling (tickets 03/04) — that path needs no hosting decision.
- Building any upload UI.

## Deliverable

An ADR draft: links-first vs. an upload rail, with the verified Convex numbers, the comparison
table, and the unlock criterion for revisiting.
