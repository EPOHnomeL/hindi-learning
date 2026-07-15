# rich-media/01: Scope image & poster Resources (upload surface)

**Status:** open
**Depends on:** —

## Why

The Resource pipeline is already media-agnostic — blob + sha256 dedupe
([`convex/resources.ts:14`](../../../convex/resources.ts#L14)), materialise writes raw bytes to
the workspace, and Claude Code reads images natively. The only hard blocker is the upload UI:
both inputs accept PDF/markdown only
([`CourseShell.tsx:438`](../../../src/app/_components/CourseShell.tsx#L438),
[`Dashboard.tsx:628`](../../../src/app/_components/Dashboard.tsx#L628)). Cheapest ticket in the
set, but the type/size policy decided here constrains every later media ticket.

## Questions to answer

- Which image types and what size cap? (Certificate emblem upload already accepts
  `png/jpeg/webp` — reuse that policy?)
- Does `resources.kind` need widening (e.g. `image`) or is the filename extension enough for
  the Routine and the sidebar? Schema change vs. zero-migration inference.
- Do image Resources need a thumbnail/preview in the Resource sidebar, or is the existing
  signed-URL "open" link enough for v1?
- Is a "poster" just an image Resource, or Topic-level art? The [[Emblem]] already covers
  course-level imagery — check for overlap before inventing a second concept.
- Privacy: strip EXIF (location data) on upload, or accept as-is for the private alpha?

## Out of scope

- Embedding images *inside* Lessons (ticket 02). This ticket is grounding-sources only.
- Video files entirely (ticket 06).

## Deliverable

A short decision note (types, cap, schema yes/no, poster = image Resource or not) plus the
acceptance-criteria list for the implementation ticket.
