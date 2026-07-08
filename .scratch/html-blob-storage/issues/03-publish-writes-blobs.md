# Publish writes blobs (mutations + teach CLI + translate)

Status: done — merged to main via PR #7 (html-blob-storage).

## What to build

Make the publish path store the HTML as a **content blob** and hand the backend a
`storageId` instead of an HTML string, using the existing `generateUploadUrl`
pattern (as `resources` does) so the HTML never transits a Convex function.

- `publishLesson`, `upsertReference`, `publishTranslation` take `storageId`
  instead of `html`. They store `htmlStorageId` on the row. Insert-once
  (Lessons/translations) and `contentHash` skip-unchanged (References) logic is
  preserved.
- Mutable References: on a changed re-publish, the row points at the new blob and
  the **previous blob is deleted** (mirrors the `resources` dedupe/delete
  behavior).
- The teach CLI publish script and the translate driver: request an upload URL,
  `PUT` the HTML to storage, pass the `storageId` to the mutation.
- **The `materialise` CLI must fetch blob content.** It pulls Lesson/Reference
  bodies back to local files for the next teach run; once bodies live in blobs
  it must `fetch()` the content URL (or resolve the blob) instead of writing the
  inline `html`, or it would write empty files. (Flagged in issue 01 with a
  `ponytail:` note + `?? ""` placeholder in `scripts/materialise.ts`.)

## Acceptance criteria

- [ ] Publishing a Lesson/Reference/translation stores the body as a blob; the row carries `htmlStorageId` and no inline `html`; the reader serves it end-to-end from the blob.
- [ ] A re-published Lesson is still treated as immutable (no-op if it exists); an unchanged Reference is still skipped by `contentHash`.
- [ ] A changed Reference re-publish deletes the old blob (asserted via `ctx.db.system.get(old)` → null).
- [ ] A bad `PUBLISH_SECRET` is refused (existing pattern).
- [ ] The teach CLI + translate driver upload via `generateUploadUrl` and pass `storageId`; the HTML is never sent as a mutation argument.

## Scope note (during implementation)

Migrating **`translations.html`** storage to blobs was deferred to a follow-up.
It has extra coupling: `publishTranslation` reads the *source* Lesson HTML in a
mutation (for the quiz-structure guard + staleness hash), which a mutation can't
do once the source is a blob. This turn instead made that source-read
**blob-tolerant** (`convex/translate.ts`): `itemHash` hashes `htmlStorageId` when
inline `html` is absent, and the quiz-structure guard is skipped when the source
body isn't inline (the run is trusted / secret-guarded). Translations keep inline
`html`; the reader already serves them correctly via `pickContentBody`. A future
ticket can move translation bodies to blobs (likely by making `publishTranslation`
an action, or validating quiz structure in the driver).

## Blocked by

- Reads emit a content URL + client fetches it
