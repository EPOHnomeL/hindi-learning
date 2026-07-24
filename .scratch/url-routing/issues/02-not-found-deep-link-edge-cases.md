# url-routing/02: Not-found & deep-link edge cases

**Status:** partial — loading guard + inline 'not found' only; no not-found.tsx / uniform 404
**Depends on:** 01 — Routing spine
**Imported:** from GitHub #36 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/url-routing/issues/02-not-found-edge-cases.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/url-routing/issues/02-not-found-edge-cases.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Topic**/course, **Lesson**, **Reference**, **Viewer**). Spec: [`../PRD.md`](../PRD.md). Decisions: [ADR 0012](../../../docs/adr/0012-app-router-url-addressable-navigation.md).

Make bad and inaccessible deep links fail clearly, now that any URL can be typed,
bookmarked, or shared. Build on the routing spine (**01**).

## Scope

- An unknown course slug, a course the caller can't access (not owner, no
  **Share**), and an unknown Lesson/Reference `key` within a valid course all
  render Next's `not-found`.
- "Doesn't exist" and "you can't see it" produce the **identical** 404, so the app
  never reveals which private Topics exist (matching the owner-or-Viewer reads,
  which already return nothing for inaccessible Topics).
- No silent fallback (e.g. bouncing a bad Lesson key to the first Lesson, or an
  inaccessible course to the dashboard).
- Because reads come from client `useQuery` (which is `undefined` while loading),
  a route shows its loading state while `undefined` and only triggers not-found
  once the query has **resolved empty** — so a slow load never flashes a 404.

## Acceptance criteria

- [ ] `/courses/<nonexistent>` renders the not-found page.
- [ ] A course owned by someone else and not shared with the caller renders the same not-found page — indistinguishable from a nonexistent one.
- [ ] `/courses/[slug]/lessons/<bad-key>` (and the reference equivalent) renders not-found rather than redirecting anywhere.
- [ ] While the underlying query is in flight, the route shows a loading state, not a flash of not-found.

## Notes

- The access guarantee itself (a non-Viewer reads nothing) is already enforced and
  tested server-side by the topic-sharing owner-or-Viewer work; this slice only
  surfaces that as a 404 in the UI. Verified manually, per repo precedent.
- If a pure not-found predicate or default-Lesson resolver falls out, give it a
  small co-located unit test in the style of `lessonSrcDoc.test.ts` — but don't
  manufacture a seam for router glue.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no `not-found.tsx` anywhere under src/app; only the loading guard + inline "not found" states exist.
