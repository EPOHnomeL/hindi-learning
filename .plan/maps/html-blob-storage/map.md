# HTML blob storage

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The inline-`html` column gone from the contract entirely, so the content read path has **one**
shape instead of two. Lessons and references already moved; this map closes the remaining
`translations.html` write path.

## Notes

- **Already landed:** lessons + references, the dominant tables (132 + 23 prod rows, largest
  bodies). The narrowing was deliberate, not incomplete.
- **What is left is `translations.html`:** `publishTranslation` still writes translated bodies
  inline, so `pickContentBody` and the client `useContentHtml` must still handle both shapes.
- **The real cost of the move so far, recorded honestly:** with source Lesson bodies in blobs,
  the markup is not readable inside a mutation, so `publishTranslation`'s **quiz-structure
  guard no longer runs** for a blob-backed source. Restoring it (validate in the driver, or
  make `publishTranslation` an action that fetches the blob) belongs with this migration —
  it is not a separate nice-to-have.
- **Schema-narrowing sequencing gotcha** (see `docs/agents/project-context.md`): Convex
  validates data on push, so dropping a field needs the data stripped of it first, as its own
  earlier merge. Plan two commits, not one.
- Skills: `convex:convex-expert`, `convex:convex-migration-helper` (widen–migrate–narrow),
  `/tdd`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Any change to what the content route serves to a reader — this is storage shape only.
