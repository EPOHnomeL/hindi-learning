---
type: task
blocked_by: []
---
# Finish emptying `lib.ts`

## Question

`convex/lib.ts` is **855 lines and about 39 exports**, and it is the repo's junk drawer.
Verified 2026-09-01.

The [architecture-deepening](../../architecture-deepening/map.md) map's ticket 02 moved out
the three concerns it scoped, and those three modules exist today: `convex/tenantFlags.ts`,
`convex/sellerStatus.ts`, `convex/progressCounts.ts`. It stopped there, and named the rest as
a follow-up that was **never ticketed**. This is that ticket.

What still lives in `lib.ts`, by concern:

- **Share and email primitives**: `shareLang`, `shareRole`, `normaliseEmail`,
  `claimPendingShares`.
- **Token and hash primitives**: `mintToken`, `hashString`, `oauthRedirectUrl`.
- **Content blob helpers**: `contentUrl`, `contentBody`, `pickContentBody`, `decodeEntities`.
- **Admin assertion**: `assertAdmin`.
- **Topic resolvers**: `topicBySlug`, `getOwnedTopic`, `getViewableTopic`, `getEditableTopic`.
- **The Edition and grant core**: `grantsFor`, `hasEntitlement`, `publishedLangs`,
  `livePublishedLangs`, `freePublishedLangs`, `holdsSeat`, `heldLangs`, `readableLang`,
  `loadEdition`, `readLesson`, `readReference`, `lessonsToc`, `referencesToc`, `editionPrice`,
  `editionAccessLevel`, `previewLessonKey`, `buildPaywall`, `lessonLocked`, `referenceLocked`,
  `translatedTitle`, `resolveEdition`, `paywallValidator`.

That last group is the file's real subject, which is why the rename is queued behind this
work rather than beside it (see [17](17-rename-lib-to-edition.md)).

**The import count is the argument for doing it now.** The follow-up note recorded
"~25 import sites" when it was written; there are **32** as of 2026-09-01. This ticket is
getting more expensive, not less, and it is the only item on this map with that property.

## Done when

The four non-Edition concerns above have their own modules, `lib.ts` holds only the Edition
and grant core, every import site compiles, and `pnpm typecheck` and `pnpm test` are green.
Splitting is mechanical, so prefer several small commits over one large one, and do not change
behaviour in the same commit as a move.
