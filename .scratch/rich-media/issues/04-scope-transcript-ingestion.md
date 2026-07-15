# rich-media/04: Scope transcript ingestion for video Resources

**Status:** open
**Depends on:** —

## Why

Without a transcript the Routine cannot ground teaching in a video ("never trust your
parametric knowledge"), so this is the load-bearing component for video-anchored courses. The
lazy-ingestion slot already exists — `processed` manifest +
[`cacheProcessedResource`](../../../convex/resources.ts#L131) (idempotent, keyed by
contentHash) — so this scopes *what fills it and how reliably*.

## Questions to answer

- Fetch mechanism for YouTube captions: timedtext endpoint, yt-dlp, or a third-party
  transcript API? **Key risk to de-risk first:** YouTube aggressively blocks datacenter IPs —
  test the chosen mechanism *from the cloud Routine's environment*, not a dev machine.
- Fallback chain when fetch fails: third-party API (cost?), owner-supplied transcript upload
  (a file Resource paired to the video?), or mark failed and teach without it?
- Manifest shape: transcript text, timed segments/chapters `{start, end, text}`, source
  language, caption provenance (manual vs auto — auto-caption quality affects trust). Ticket
  07 consumes this shape; agree it here.
- When does ingestion run — lazily at first materialise (current design intent, issue-06
  pattern) or eagerly at add time? Eager gives the learner early feedback that their video is
  usable; lazy is less plumbing.
- Failure UX: a Resource stuck `raw`/`processing` is invisible today — does the sidebar need a
  "couldn't ingest" state?

## Out of scope

- Caption-less videos / speech-to-text (ticket 05).
- Uploaded video files (ticket 06) — assume a YouTube/URL source here.

## Deliverable

A tested (spiked) answer on fetch reliability from the Routine's IP range, the chosen
mechanism + fallback chain, and the agreed `processed` manifest schema.
