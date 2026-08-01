# Rich media

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A locked set of decisions for **video, audio, and image media** across the course lifecycle —
what can be uploaded, how it embeds in a Lesson, how a link becomes ingested content, where
files are hosted, and how a Lesson cites the course's own Resources.

## Notes

- **Ticket 01 is a merged umbrella.** Nine separately-scoped tickets (image/poster Resources,
  media embedded in Lessons, YouTube embed, transcript ingestion, transcription fallback,
  uploaded-video hosting, video-anchored teach mode, provider-path ingestion, Editions ×
  embedded media) were merged into one effort — they are facets of one integration, not nine
  features. Their scope lives in ticket 01's body. The gap in numbering between 01 and 11 is
  those merged and resolved identities; `NN` is never reused.
- **The Resource pipeline is already media-agnostic** — blob + sha256 dedupe in
  `convex/resources.ts`, materialise writes raw bytes, Claude Code reads images natively.
  **The only hard blocker is the upload UI**, which accepts PDF/markdown only. That makes the
  type/size policy the cheapest decision *and* the one constraining every later media ticket —
  take it first.
- **The provider split is the recurring constraint:** Convex actions cannot run ffmpeg. TTS
  and transcript fetches are plain HTTP and fine; transcoding and video rendering are not.
  Every hosting or ingestion answer has to respect it — the same wall
  [Scope the course trailer](../media-generation/tickets/01-scope-course-trailer.md) hits.
- **Ticket 11 (Resource links) is the odd one out and deliberately un-merged** — it is about
  linking into the course's *own uploaded documents* from Lesson prose, not media playback. It
  is the most specified thing on this map (labelled ready-for-agent on GitHub) and is
  independently takeable. Its durability rule matters: address the Resource by stable id and
  mint a fresh signed URL at click time, **never** bake in an expiring URL, so the link
  survives immutable Lesson HTML and translation.
- **Ticket 12 asks whether it is time to un-defer page-level precision.** Whole-resource
  linking was the deliberate cut; "see p. 42" is exactly the precision that was deferred.
  Blocked on 01.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `/ponytail` (nine merged
  facets is exactly where scope creep lives).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Remediation policy** when a learner fails a video-anchored comprehension gate. The same
  seam surfaces in [pedagogy](../pedagogy/map.md) — one owner, not two.
- **Cost of media at Edition scale.** Media multiplied by languages is a real bill; depends on
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).

## Out of scope

- The marketing trailer and learner podcast ([course-media](../media-generation/map.md)) — those
  *generate* media; this map *ingests and serves* it.
