# rich-media/03: Scope YouTube-link Resources & player embed

**Status:** open
**Depends on:** —

## Why

[`addUrlResource`](../../../convex/resources.ts#L68) already records any URL, so a YouTube
link is a valid Resource today with zero changes. What needs scoping is making it *useful*:
recognising it as a video, showing something better than a bare link, and defining the embed
component Lessons will use (which ticket 07's teach mode builds on).

## Questions to answer

- Classification: detect YouTube (and generic video?) URLs at add time and store a subkind, or
  infer at render? Subkind on the row survives URL-shape changes; inference needs no migration.
- Metadata: fetch oEmbed (title, duration, thumbnail) at add time (mutation can't fetch — needs
  an action) or lazily via the Routine into `processed`? What does the Resource sidebar show?
- Embed component: an `assets/` component wrapping the iframe — `youtube-nocookie.com`?
  `?start=&end=` segment params (load-bearing for ticket 07)? Fallback link when embedding is
  disabled by the video owner?
- Reader constraints: any CSP/frame-ancestors policy on the reader that blocks iframes? What
  does a [[Guest]] on a Public link see (iframe works logged-out, but confirm)?
- Non-YouTube video URLs (Vimeo, raw .mp4 links): in scope now or explicitly later?

## Out of scope

- Transcript fetching (ticket 04) — this ticket is the link/embed/metadata surface only.
- Teach-mode authoring policy (ticket 07).

## Deliverable

Decision note: classification approach, metadata strategy, embed component spec (props:
videoId, start, end), and the v1 answer for non-YouTube URLs.
