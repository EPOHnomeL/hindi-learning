# Content-blob serving foundation (expand)

Status: done — merged to main via PR #7 (html-blob-storage).

## What to build

The plumbing to store and serve **content blobs**, with no behavior change yet —
every row still carries its inline `html`. This is the expand step of the M1
migration: everything added here is additive and backward-compatible.

- Widen the schema: add `htmlStorageId` (optional `_storage` id) to `lessons`,
  `references`, and `translations`, and make the existing `html` fields
  **optional** (a row will soon have a blob instead of a string). `translations.html`
  is already optional.
- Add a `/content` HTTP route on the existing `http.ts` router that streams a
  stored blob by its storageId with `Cache-Control: public, max-age=31536000,
  immutable` and the CORS header the reader origin needs; 404 for an
  unknown/missing id.
- Add a shared resolver helper: given a row's `{ htmlStorageId?, html? }`, return
  the discriminated read shape — a **content URL** when a blob exists, else the
  inline `html` string.

## Acceptance criteria

- [ ] `lessons`/`references`/`translations` accept an optional `htmlStorageId`; `html` is optional on all three; existing rows and tests still validate.
- [ ] `GET /content?id=<storageId>` returns the blob body with `Cache-Control: public, max-age=31536000, immutable` and a CORS header; unknown/missing id → 404.
- [ ] The resolver helper returns a content URL for a row with `htmlStorageId`, and the inline `html` for a row without one.
- [ ] Seam 2 tests (`t.fetch`) cover the 200-with-headers and 404 cases.

## Blocked by

- None — can start immediately.
