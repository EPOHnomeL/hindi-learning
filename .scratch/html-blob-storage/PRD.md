# PRD: Move Lesson / Reference HTML out of DB rows into cacheable file storage

Status: done — merged to main via PRs #7/#8/#9. Inline HTML now lives in cacheable content blobs (translations deferred, see issue 05).

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Lesson**,
> **Reference**, **Edition** (a Topic × language, course-translation),
> **Routine**, **owner** vs **Viewer**, **Guest** (anonymous public-link reader).
> This feature adds one internal term: a **content blob** — a Lesson's,
> Reference's, or translated item's rendered HTML body, stored as a Convex File
> Storage object and served over HTTP, rather than as a string field on the DB
> row. It respects [ADR 0013](../../docs/adr/) (the Guest read seam / public
> links) and the existing owner-or-Viewer authorization gates — the *authorization*
> model is unchanged; only *where the HTML lives and how it's served* changes.

## Problem Statement

The app is pinned against two Convex free-tier limits at once:

- **Database I/O (~1 GB/mo, ~99% reads)** — escalating daily as Editions
  multiply. Root cause: the Lesson/Reference HTML body is stored *inside* the DB
  row, so **list queries read every full HTML body just to return titles**.
  `listLessons`, `publicCourse`, and the `editionMap` helper `.collect()` over
  `lessons` / `references` / `translations` rows — each row carrying its fat
  `html` field — then discard the HTML and return only `{key, seq, title}`. Every
  sidebar render, on every reactive tick, drags megabytes of HTML through the
  database to produce kilobytes of titles.
- **Data Egress (~1 GB/mo, ~94%)** — the immutable Lesson HTML rides a
  *reactive query* (`getLesson` / `publicLesson`), which is **not HTTP-cacheable**.
  Every open, re-open, refresh, or reconnect re-transfers the full body over the
  websocket. Immutable content served on a non-cacheable channel pays full price
  every time.

Both stem from the same design choice: **immutable HTML lives in reactive DB
rows.** Storage itself is not the problem (20 MB total); *moving* the HTML is.

## Solution

Move the three browser-served HTML bodies out of the DB and into Convex File
Storage, served over a cacheable HTTP route:

- **`lessons.html`, `references.html`, `translations.html`** (rows of
  `kind: "lesson"` / `"reference"`) become **content blobs**. The DB row keeps
  its metadata (`key`, `seq`, `title`, …) plus a new `htmlStorageId`.
- A custom HTTP route serves a blob by its storageId with
  `Cache-Control: public, max-age=31536000, immutable` (content is immutable, so
  the storageId is a stable cache key) and a CORS header for the reader origin.
- The reader **query authorizes exactly as today** (owner-or-Viewer, or Guest
  token) and returns a **content URL** instead of the HTML string. The client
  `fetch()`es that URL — `fetch` honours the HTTP cache, so re-reads are served
  from the browser's disk with zero network — and feeds the existing `Frame`
  iframe + quiz bridge unchanged.

This hits **both** maxed metrics:

- **DB I/O reads collapse** — list queries and `getLesson` read thin rows;
  file-storage reads are not counted as Database I/O.
- **Egress becomes cacheable** — re-reads/refreshes/reconnects hit the browser
  cache, not the wire.

The URL is an unguessable **bearer capability** (matching the existing
`resources` / `emblem` pattern via `ctx.storage`): the query gates *who learns*
the URL; the URL, once known, serves the blob without a per-request auth check.
Lesson HTML is low-sensitivity educational content, so this is an accepted trade
for cacheability.

Migration is **widen → migrate → narrow** (M1): add `htmlStorageId` alongside the
still-present `html`; the read path prefers the blob and falls back to inline
`html`; a one-shot backfill uploads existing bodies to blobs; then `html` is
dropped once verified.

## User Stories

### Learner / owner (authed reader)
1. As an owner reading a Lesson, I want it to render exactly as it does today (same iframe, quizzes, title, RTL), so that this optimization is invisible to me.
2. As an owner re-opening a Lesson I've already read this session, I want it served from my browser cache with no re-download, so that navigation is instant and cheap.
3. As an owner refreshing or reconnecting, I don't want the full Lesson body re-transferred every time, so that the app stays within its bandwidth budget.
4. As an owner scanning the Lesson/Reference sidebar, I want the list to load without the backend reading every Lesson's full body, so that the course view is fast and doesn't burn database I/O.
5. As a learner opening a Lesson for the first time, I accept a brief load while the body is fetched, so long as it's fast and only happens once per body.

### Viewer (shared Edition)
6. As a Viewer of a shared Edition, I want Lessons and References to render identically, in my granted language, so that the change is transparent to me.
7. As a Viewer, I want my access still gated by my Share, so that moving HTML to storage never widens what I can see.

### Guest (public link)
8. As a Guest on a public link, I want the course shell and each Lesson/Reference to render exactly as before, in the Edition the token serves, so that public links keep working.
9. As a Guest, I want an invalid/unknown token to still reveal nothing, so that the privacy guarantees of the Guest read seam are preserved.

### Teach CLI (publish)
10. As the teach CLI publishing a Lesson, I want to upload its HTML directly to storage and hand the backend a storageId, so that the HTML never transits a Convex function.
11. As the teach CLI, I want unchanged References skipped (by `contentHash`) and already-published Lessons treated as immutable, exactly as today, so that publish stays idempotent.
12. As the teach CLI re-publishing a changed Reference, I want the old blob replaced and cleaned up, so that storage doesn't accumulate orphans.
13. As the translate Routine publishing a translated item, I want to upload the translated HTML as a blob the same way, so that Editions get the same treatment as the source.

### Operator (migration)
14. As the operator, I want a one-shot, secret-gated, paginated backfill that moves every existing Lesson/Reference/translation body into a blob, so that existing content benefits without a re-publish.
15. As the operator, I want the backfill to be idempotent, so that re-running it is a safe no-op.
16. As the operator, I want the app to keep serving correctly *during* the migration (blob when present, inline HTML otherwise), so that there is no downtime window.
17. As the operator, I want to drop the inline `html` fields only after the backfill is verified in production, so that I never strand un-migrated content.

### System / integrity
18. As the system, I want the content route to return the correct body with long-lived immutable cache headers, so that browsers and any CDN cache aggressively.
19. As the system, I want a request for an unknown/missing storageId to 404, so that the route fails cleanly.
20. As the system, I want the content URL to carry the CORS header the reader origin needs, so that the cross-origin `fetch` from the web app succeeds.

## Implementation Decisions

- **Approach: Convex File Storage, storageId-keyed URL (A1-simple).** Rejected:
  content-hash addressing (`contentBlobs` table + per-publish hashing) — the
  cross-Edition dedupe it buys is ~zero here (translations are distinct content
  per language), so it's machinery for no benefit. The storageId is already a
  stable, unguessable key; for an immutable Lesson/translation it never changes,
  so its URL is `immutable`-cacheable as-is.
- **Serving: a custom HTTP route, not plain `getUrl()`.** Convex's default
  `getUrl()` URLs lack strong `immutable`/`max-age` cache headers, so they'd give
  the thin-row win but not the re-read caching win. The custom route
  (registered on the existing `http.ts` router) reads the blob by storageId and
  responds with `Cache-Control: public, max-age=31536000, immutable` + the CORS
  header. This is the piece that makes egress actually drop.
- **Auth: bearer-capability URL (A1a).** The route does no per-request auth
  (that would defeat caching and require the session token). The reader query
  authorizes *who learns the URL*, exactly as today. Consistent with the existing
  `resources` / `emblem` bearer URLs. Accepted because Lesson HTML is
  low-sensitivity.
- **Scope: exactly three fields.** `lessons.html`, `references.html`,
  `translations.html` (kinds `lesson` / `reference`). Left inline: all titles /
  `text` / `mission` / `question` bodies (tiny, and list queries need titles
  without a fetch), and `learningRecords.markdown` (CLI-only, not the cap
  pressure).
- **Schema (widen phase):** add `htmlStorageId: v.optional(v.id("_storage"))`
  to `lessons`, `references`, and `translations`. Keep `html` optional during
  transition. **Narrow phase:** remove `html` from `lessons` / `references`, and
  `translations.html`, once backfilled.
- **Read contract (transition):** the per-item read seams (`getLesson`,
  `getReference`, `publicLesson`, `publicReference`) return a **content URL**
  resolved from `htmlStorageId`, falling back to the inline `html` string when no
  blob exists yet. The client prefers the URL (fetch) and otherwise renders the
  inline string. After narrow, only the URL path remains.
- **List queries** (`listLessons`, `listReferences`, `publicCourse`, the
  `editionMap`/`trOne` helpers) must stop depending on `html` — they already
  return only titles, so once the field is gone they simply read thin rows. Where
  a helper `.collect()`s translations for a title map, it must not require `html`.
- **Publish contract (P1):** `publishLesson`, `upsertReference`,
  `publishTranslation` take a `storageId` instead of an `html` string. The teach
  CLI / translate driver uses the existing `generateUploadUrl` pattern (as
  `resources` does): request an upload URL, `PUT` the HTML to storage, pass the
  resulting `storageId` to the mutation. HTML never passes through a function.
  Immutable Lessons/translations upload once; mutable References upload a new blob
  and **delete the previous one** on change (mirrors the `resources` dedupe/delete
  test).
- **Backfill (must be an action):** `ctx.storage.store()` is action-only, so the
  one-shot backfill is an **action** that pages through each table (like the
  existing `backfillQuizShuffle` driver), reads the inline `html`, stores it as a
  blob, and patches `htmlStorageId` via a mutation. Secret-gated, idempotent
  (skip rows that already have `htmlStorageId`), driven by a `tsx` script.
- **Client (F1):** `getLesson`/`publicLesson`/`getReference`/`publicReference`
  consumers (`ArtifactView`, `PublicReader`) `fetch()` the content URL and pass
  the text to the existing `<Frame html={…} withBridge>` — the iframe and quiz
  `postMessage` bridge are untouched. A loading state covers the first
  (uncached) fetch. Reader is client-rendered (`useQuery`), so no SSR wrinkle.

## Testing Decisions

- **Good tests assert external behavior at a seam, not internals** — in the
  established convex-test style: seed Users/Topics/Lessons with `t.run`, act as a
  caller with `withIdentity`, set `PUBLISH_SECRET` in `beforeAll`, assert what
  each caller can do and see. Prior art: `convex/content.test.ts`,
  `convex/resources.test.ts` (blob storage via `ctx.storage.store` +
  `ctx.db.system.get(storageId)` to assert blob existence/deletion).
- **Seam 1 — the Convex function API** (`convexTest`, extending
  `content.test.ts`):
  - **Publish** stores the body as a blob and the row carries `htmlStorageId`
    and no inline `html`; a bad `PUBLISH_SECRET` is refused (existing pattern).
  - **Read** (`getLesson`/`getReference`/`publicLesson`/`publicReference`)
    returns a resolvable content URL; during transition, falls back to inline
    `html` when `htmlStorageId` is absent.
  - **List** (`listLessons`/`listReferences`/`publicCourse`) returns the same
    thin `{key, seq, title}` shape and does not depend on `html`.
  - **Backfill** action: seed a row with inline `html`, run it, assert a blob now
    exists and `htmlStorageId` is set; re-running is a no-op; the narrow step
    clears `html`.
  - **Mutable Reference** re-publish uploads a new blob and deletes the old
    (`ctx.db.system.get(old)` → null), mirroring the `resources` test.
- **Seam 2 — the `/content` HTTP route** (`t.fetch`): streams the blob body for a
  known storageId; 404 for unknown/missing id; sets
  `Cache-Control: …immutable` and the CORS header. These headers are the point of
  the feature and are only observable at the HTTP boundary.
- **No automated frontend test** for the `Frame` fetch/loading change — the repo
  has no component-test infra and verifies reader affordances manually (as
  course-completion / topic-sharing did). The correctness that matters lives at
  the two seams above; the reader change is verified manually.

## Out of Scope

- **Static-to-CDN hosting (approach B)** — moving egress off Convex entirely to
  Vercel. Rejected: it breaks the authed access model (a static CDN file can't
  enforce owner-or-Viewer gating without a per-fetch session re-check) and splits
  the source of truth. Revisit only if Convex egress stays a problem after this.
- **In-DB compression (approach C)** — doesn't fix caching or row-fatness and may
  be redundant with any wire compression; strictly weaker than A1.
- **Content-hash addressing / cross-Edition dedupe** — no benefit for this data.
- **Moving `learningRecords.markdown`** out of the DB — CLI-only read path, not
  the cap pressure.
- **Moving titles / `text` / `mission` / `question` bodies** — tiny, and titles
  are needed inline for list queries.
- **A CDN in front of the content route** — the browser HTTP cache is the win
  for the single-learner case; a shared CDN can be layered later if public-link
  fan-out grows.
- **Any change to the authorization model** — owner-or-Viewer and Guest-token
  gating are unchanged.

## Further Notes

- The backfill is the **last time** the app pays to drag this HTML through the
  database. Do it once, correctly.
- The DB I/O escalation (Jul 6→8) tracked the translation/Editions work landing —
  more Editions meant list queries reading more translation HTML per tick. This
  change removes that growth term entirely.
- Implementation is sequenced widen → reads → writes → migrate → narrow (see
  `issues/`), which is the expand–contract execution of the M1 strategy — each
  phase keeps the app green because inline `html` remains until the final
  contract step.
