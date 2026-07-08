# Reads emit a content URL + client fetches it

Status: ready-for-agent

## What to build

Switch the per-item read seams to return a **content URL** (falling back to
inline `html` during transition), and make the reader fetch it. Rendering is
unchanged — the `Frame` iframe + quiz bridge are untouched; only the source of
the HTML string changes.

- `getLesson`, `getReference`, `publicLesson`, `publicReference` return the
  resolver's discriminated shape: `contentUrl` when the row has a blob, else the
  inline `html`. Titles and other metadata are unchanged.
- List queries (`listLessons`, `listReferences`, `publicCourse`, and the
  `editionMap` / `trOne` helpers) must not depend on `html` — they already
  return only titles.
- `ArtifactView` and `PublicReader`: when the read returns a `contentUrl`,
  `fetch()` it and feed the text to `<Frame html={text} withBridge>`; when it
  returns inline `html`, render that directly. Add a loading state for the
  first (uncached) fetch. `fetch` honours the HTTP cache, so re-reads are free.

## Acceptance criteria

- [ ] For a row with `htmlStorageId`, the read seam returns `contentUrl` (no `html`); for a row with only inline `html`, it returns `html` (no `contentUrl`).
- [ ] Reader renders a Lesson/Reference identically whether the body came from a fetched URL or inline `html`; quizzes still post back through the bridge.
- [ ] A first (uncached) blob fetch shows a loading state, then the rendered body.
- [ ] Guest (public-link) Lesson/Reference reads render identically; an invalid token still reveals nothing.
- [ ] Seam 1 read tests assert the discriminated shape and the inline fallback.

## Blocked by

- Content-blob serving foundation (expand)
