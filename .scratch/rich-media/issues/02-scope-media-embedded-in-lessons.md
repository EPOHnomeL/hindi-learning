# rich-media/02: Scope media embedded inside Lessons (content route + publish path)

**Status:** open
**Depends on:** —

## Why

Lessons are self-contained HTML fragments whose bodies live as content blobs served over
[`GET /content?id=`](../../../convex/http.ts) (immutable caching, storageId as bearer
capability). Embedding an image/poster *inside* a Lesson needs a convention for how an
authored lesson references media that only becomes a storage id at publish time — today
[`publish.ts`](../../../scripts/publish.ts) uploads lesson HTML only.

## Questions to answer

- Is storageId-as-capability acceptable for lesson-embedded media? (Same authorization model
  as lesson HTML itself — anyone with the lesson body already holds the media ids inside it —
  so presumably yes, but say so explicitly.)
- Publish flow: the teach skill authors `<img src="./assets/foo.png">` locally — does publish
  rewrite local asset paths to `/content?id=` after uploading each asset, or do lessons
  reference already-uploaded Resource blobs directly? What does materialise do on the way back
  down (round-trip fidelity)?
- Immutability: lessons are immutable — are their embedded media blobs immutable too
  (mint-new-never-overwrite, like the Emblem pattern)? What deletes them when a lesson is
  superseded or a Topic deleted?
- Size discipline: cap per-image and per-lesson total so the reader stays fast.
- Does the `/content` route need `Content-Type` handling beyond HTML (it serves whatever the
  blob's stored type is — verify for images)?

## Out of scope

- Video embeds (tickets 03/06) — this ticket is the generic blob-in-lesson mechanism, scoped
  to images first.

## Deliverable

The authoring→publish→materialise convention written up as a draft AUTHORING.md section, plus
a decision on lifecycle/immutability. Likely feeds an ADR alongside ADR 0009.
