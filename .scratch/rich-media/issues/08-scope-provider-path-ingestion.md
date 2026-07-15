# rich-media/08: Scope ingestion across provider paths (Claude routine vs OpenRouter)

**Status:** open
**Depends on:** —

## Why

A Topic's `provider` (ADR 0014) selects who authors: the Claude Routine runs on a real machine
(shell, yt-dlp, page renderers — where lazy ingestion was designed to live), while the
OpenRouter path authors inside Convex actions —
[`openrouter.ts`](../../../convex/openrouter.ts) — with no shell and tight runtime limits.
Video/media ingestion therefore doesn't port automatically to the BYOK/OpenRouter line, and
that asymmetry should be a decision, not a surprise.

## Questions to answer

- V1 position: are media/video features **Claude-line-only** (documented support-matrix gap),
  or must both providers work from day one?
- If both: move ingestion out of authoring time — e.g. ingest at add time (a Convex action
  fetching captions may work; anything needing a shell won't) so *any* author just reads a
  ready `processed` manifest. What subset of tickets 03–05 is action-compatible?
- Can the OpenRouter author even consume the manifest well (transcript in-context vs. context
  budget of GLM-class models on long videos)? Chunking policy?
- Does the support matrix belong in ADR 0014 as an amendment, or a new ADR?

## Out of scope

- Implementing either path's ingestion (tickets 04/05 own the mechanics).

## Deliverable

A provider support-matrix decision (which media features on which line, and why) recorded
against ADR 0014.
