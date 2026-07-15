# rich-media/10: Scope AI deep-linking into course Resources

**Status:** open
**Depends on:** 04 (for timestamp anchors)

## Why

"Add a way for the AI to link directly to the resources in the course" (note resolved
2026-07-15). The teach skill's citation rule points at *external* URLs today, while the
learner's own uploaded [[Resource]]s — the trusted sources teaching is grounded in — are only
reachable as whole files from the sidebar
([`listResources`](../../../convex/resources.ts#L155) returns signed blob URLs). A lesson
should be able to say "Handbook, p. 34" or "watch 02:14–03:00" and take the reader *there*.

## Questions to answer

- Link target: signed storage URLs **expire**, so lesson HTML (immutable!) must not bake them
  in. A stable reader route per Resource (`/courses/<slug>/resources/<id>`) that resolves a
  fresh signed URL at click time? Or serve resource blobs over the `/content` route
  (storageId-as-capability, like lesson bodies — but that makes Resource blobs bearer-public
  to anyone holding the lesson HTML: same model as embedded media, decide together with
  rich-media/02)?
- Fragment addressing: PDFs — `#page=N` works in browser viewers; video — `?t=` /
  `#t=start,end` (needs ticket 04's timestamps for the AI to *know* the anchor); images —
  none needed. What's the citation syntax the teach skill writes (extend AUTHORING.md's
  citation format)?
- Authoring-side knowledge: the workspace `resources/_index.json` has filename/hash/status —
  it needs the *reader URL* (or Resource id) per file so the AI can mint links at authoring
  time. Extend `materialiseTopic`'s payload?
- Access: Viewers get resource links working today (owner-or-viewer gated); what about
  [[Guest]]s on a Public link — do resource deep-links work logged-out (currently the Guest
  read seam doesn't cover signed resource URLs — check `public.ts`)?
- Translations: citations inside translated lesson bodies must keep working (the translate
  pass preserves hrefs — same guard as rich-media/09).

## Out of scope

- Embedding resource *content* inside lessons (rich-media/02) — this is linking, not
  embedding.
- Transcript ingestion itself (04).

## Deliverable

The stable-URL decision (route vs content-capability), the citation syntax for AUTHORING.md,
the materialise payload change, and the Guest answer.
