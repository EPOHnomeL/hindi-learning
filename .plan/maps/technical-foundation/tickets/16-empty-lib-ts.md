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

## Answer

Done 2026-09-03. `convex/lib.ts` holds only the Edition and grant core.

### True numbers

The counts in the Question were partly stale, so they were recounted before any edit:

| | before (2026-09-03, pre-work) | after |
| --- | --- | --- |
| lines in `lib.ts` | 855 (as stated) | 623 |
| top-level `export`s | **48**, not "about 39" (37 functions, 9 types, 2 consts) | 30 |
| `from "./lib"` import statements | **33**, not 32 (the forgot-password work of that morning added none; the drift is older) | 16 |

Three of the "32 import sites" the Question counted were prose mentions of `convex/lib.ts`
in comments (`content/authoring.ts`, `dashboard.test.ts`, `schema.ts`), not imports; those
are untouched and still read correctly.

### Modules created

Seven, not four. Each is a plain module with no Convex functions registered, matching
`tenantFlags.ts` / `sellerStatus.ts` / `progressCounts.ts`:

- `convex/sourceLang.ts` (10 lines): `SOURCE_LANG`. Not one of the ticket's concerns, and a
  deliberate deviation from "the Edition core stays". It had to move first: the grant core
  reads `shareLang`, and `shareLang` and `claimPendingShares` read `SOURCE_LANG`, so leaving
  the constant behind would have made `lib.ts` and the new share module a circular import.
  A shared root constant keeps that edge one-way. It is the one thing that left `lib.ts`
  that arguably belonged there.
- `convex/shareGrants.ts` (57): `shareLang`, `shareRole`, `normaliseEmail`,
  `claimPendingShares`.
- `convex/tokens.ts` (26): `mintToken`, `hashString`.
- `convex/authRedirect.ts` (51): `oauthRedirectUrl`. Split from the token concern rather than
  bundled with it: it is an open-redirect guard, not a token, and the repo already had a test
  file named `convex/authRedirect.test.ts` written against it, which named the module for us.
- `convex/contentBlobs.ts` (52): `ContentBody`, `contentUrl`, `contentBody`,
  `pickContentBody`, `decodeEntities`.
- `convex/adminSecret.ts` (10): `assertAdmin`.
- `convex/topicAccess.ts` (71): the topic resolvers, see below.

No re-export shims were left anywhere. Every import site was updated to the real module, so
`lib.ts` is genuinely 16 importers lighter and not merely narrower.

### The topic resolvers: moved

`topicBySlug`, `getOwnedTopic`, `getViewableTopic` and `getEditableTopic` went to
`convex/topicAccess.ts`. Three reasons, in the order they decided it:

1. **Their subject is the Topic row, not the Edition.** All four return
   `Doc<"topics"> | null`. `getViewableTopic` and `getEditableTopic` do consult the grant
   walk, but as consumers of it: the dependency points one way, `topicAccess.ts` imports
   `grantsFor` from `lib.ts` and `lib.ts` imports nothing back.
2. **Ticket 17 is the tiebreaker.** It renames `lib.ts` to `edition.ts`, on the recorded
   ground that renaming a file that still hosts unrelated helpers "would misname it more
   precisely than `lib` does". `edition.ts` containing "give me the topic row for this slug"
   is exactly that failure, one round later.
3. **The family stays together.** Splitting the two grant-consulting resolvers from the two
   plain ones would make callers import "the topic for this slug" and "the topic if this
   caller may read it" from two modules, which is worse than either whole choice.

### Deliberately left in `lib.ts`

- `holdsSeat`, which reads `seats` and belongs to the Organisation Voucher rail rather than
  to Editions. The ticket lists it under the core and its own comment argues for its
  location, so it was not this ticket's call to overturn.
- The stale `.scratch/` path in the content-blob banner comment. `.scratch/` is retired; the
  reference travelled verbatim with the move rather than being silently rewritten.

### Bug spotted, not fixed

None. Nothing was found that changes behaviour, and no commit here changes any.

One factual claim was corrected as a side effect, in its own commit and not in a move
commit: `decodeEntities` carried a parenthetical saying it lived outside `convex/content.ts`
to avoid a cycle and was "re-exported from content.ts for its existing importers". There is
no `convex/content.ts` any more (it is `convex/content/`), and nothing re-exports it; that
had been dead prose for some time and the move made it actively misleading.

`docs/ponytail-debt.md`, harvested this same morning, was corrected in place too: it recorded
16 as open and unclaimed with `lib.ts` at 855 lines, and anchored its `decodeEntities` row on
`convex/lib.ts:369`.

**Ticket 17's own "(currently) 32 sites" is now 16.** It was not edited, since only this
ticket was claimed.

### Evidence

`pnpm typecheck` clean and `pnpm vitest run` green after every one of the seven commits:
**86 files, 1037 tests passed**, identical to the baseline taken before the first edit. This
ticket's Done when is entirely compile-and-test checkable, so the evidence is a green
typecheck and suite, **not a browser walk** - nothing was clicked, and nothing needed to be,
because no commit here changes behaviour.
