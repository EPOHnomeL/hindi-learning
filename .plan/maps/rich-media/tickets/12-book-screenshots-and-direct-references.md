---
type: grilling
blocked_by: [01]
---

# Book screenshots + direct references as lesson media

## Question

**Depends on / overlaps:** rich-media scoping tickets for image Resources (`.plan/maps/rich-media/tickets/01-scope-image-poster-resources.md`), media embedded in lessons (`02-scope-media-embedded-in-lessons.md`), and Resource deep-linking (`10-scope-resource-deep-linking.md`, resolved).

## Why

Request (2026-07-24): "properly display other media like Screenshots from books and images" plus "direct references to the books and resources." A learner or the teach skill wants to show a screenshot/excerpt lifted from a book/PDF Resource inline in a Lesson, with a citation back to the exact source it came from — not just link to the whole Resource.

This sits across three already-scoped pieces without being identical to any one of them:

- **01** scopes the image-upload surface generally (types/size/schema), but not screenshots-derived-from-another-Resource specifically.
- **02** scopes the mechanism for embedding a blob inside Lesson HTML, which a book screenshot would use as-is.
- **10** resolved AI linking into Resources as **whole-resource only** — page/timestamp anchors (`#page=N`) were explicitly deferred. A "direct reference to the book" (e.g. "see p. 42") is exactly that deferred precision, so this ticket is partly "is it time to pick that back up."

## Questions to answer

- Is a "screenshot from a book" just an image Resource (01) that happens to be manually captured by the learner/author from a PDF, or does it need first-class provenance (e.g. "this image was cropped from Resource X, page N")? The former needs no new schema; the latter needs a source-Resource + page field.
- Does "direct reference to the book" mean (a) reuse the existing whole-resource `.cite` link from ticket 10/11 as-is, or (b) require the page-level anchor that 10 explicitly deferred? If (b), this ticket is the trigger to un-defer that scope.
- Where does the screenshot get taken/cropped — is this an authoring-time step (teach skill crops from a PDF Resource while drafting) or a learner-facing upload feature?
- Does the citation for a screenshot need to point at *both* the embedded image (02) and the source book Resource (10) simultaneously — i.e. an image with a caption-link back to the page it came from?

## Out of scope

- The general image-upload surface itself (ticket 01) and the generic embed-in-lesson mechanism (ticket 02) — this ticket only covers what's specific to *derived-from-a-book* screenshots.
- Video-anchored references (07) — text/image sources only here.

## Deliverable

A decision on whether this is fully covered by 01+02+10/11 as already scoped, or whether it requires page-level Resource anchors (un-deferring part of ticket 10) and/or a screenshot-provenance field. Feeds whichever existing ticket(s) it turns out to extend, or a new implementation ticket if page anchors get un-deferred.

## Done when

A decision on whether tickets 01 and 11 already cover this as scoped, or whether it needs page-level Resource anchors (un-deferring part of the resolved deep-linking ticket) and/or a screenshot-provenance field.

<!-- Migrated 2026-07-30 from GitHub issue #108 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
