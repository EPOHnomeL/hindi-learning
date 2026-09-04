---
type: task
blocked_by: [16]
---
# Rename `lib.ts` to `edition.ts`

## Question

Once [16](16-empty-lib-ts.md) has emptied it, `convex/lib.ts` holds one thing: the Edition
reader, the grant resolver and the paywall. At that point the name `lib` actively misleads,
and the rename is a one-line-per-import mechanical change across **16 sites**, verified by
grep on 2026-09-03. The "32" this line used to carry was never quite right and is now well
out of date: ticket 16 counted 33 `from "./lib"` import statements before it started (three
of the ticket's 32 were prose mentions in comments, not imports) and left 16 behind when it
finished. Emptying the file halved the rename.

**This is deliberately its own ticket, and deliberately blocked.** The
[architecture-deepening](../../architecture-deepening/map.md) map recorded the rename as
**declined until the file is emptied**, on the grounds that renaming a junk drawer to
`edition.ts` while it still hosts `assertAdmin`, `mintToken` and the share helpers would
misname it more precisely than `lib` does. That reasoning still holds, and the edge on this
ticket is what enforces it.

## Done when

`convex/edition.ts` exists, `convex/lib.ts` does not, every import site is updated, and
`pnpm typecheck` and `pnpm test` are green. One commit, no behaviour change.

## Answer

Done 2026-09-04. `convex/edition.ts` exists, `convex/lib.ts` does not, and no shim was left
behind: a re-export at the old path would have kept the misleading name in the tree, which is
the only thing this ticket existed to remove.

### The count

**16 import sites**, re-verified by grep immediately before the first edit, matching the
corrected figure in the Question. Fifteen were `from "./lib"` inside `convex/`, and the
sixteenth was `from "../lib"` in `convex/content/reader.ts`. All sixteen now name `./edition`
or `../edition`; sixteen files changed, one line each.

### No Convex API path changed, so no deploy window

`lib.ts` registered **zero** Convex functions, no `query`, `mutation`, `action` or any internal
variant, and there were **zero** `api.lib.` or `internal.lib.` references anywhere in `src/`,
`convex/` or `scripts/`. So nothing addressed the module by API path and the rename could not
break a client mid-deploy. It is a pure TypeScript import rename, which is why it did not need
to be staged behind a compatibility shim or a deploy window.

`convex/_generated/api.d.ts` does name the module, so it changed: `import type * as lib from
"../lib.js"` became `edition`, in both the import block and `fullApi`. Regenerated with
`npx convex codegen` and committed, not hand-edited.

The move was `git mv`, and git recorded it as a rename at 98% similarity, so
`git log --follow convex/edition.ts` still reaches the whole history of `lib.ts`.

### The header comment

It described the file by what had left it: "The Edition and grant core ... Everything else that
used to live here moved to its own module in technical-foundation/16." It now opens by naming
the file and its subject, then keeps the negative claim that earns the name:

> `convex/edition.ts`: the Edition reader, the grant resolver and the paywall. Who holds which
> Edition of a Topic, which one to serve them, how its rows read, and what the paygate
> withholds. (Plain module, no Convex functions registered here.) Everything else that used to
> live here moved to its own module in technical-foundation/16; technical-foundation/17 then
> renamed the file from `lib.ts`, because with only this subject left the old name described a
> junk drawer that no longer exists.

### Prose references repointed

Twenty-six files, in their own commit after the rename, comments and docs only.

**Eighteen code comments** named `lib.ts`. The ten provenance lines ("Split out of `lib.ts` by
technical-foundation/16") now read "Split out of `edition.ts` (then `lib.ts`) by ...", in
`adminSecret.ts`, `authRedirect.ts`, `shareGrants.ts`, `tokens.ts`, `contentBlobs.ts`,
`progressCounts.ts`, `sellerStatus.ts`, `tenantFlags.ts`, `topicAccess.ts` and `sourceLang.ts`.
The judgement call: a path that resolves to nothing is worse than a slightly anachronistic one,
and it is the same file by git identity, so the current name leads and the old one stays in a
parenthetical for anyone reading the ticket numbers. The present-tense mentions were repointed
outright, in `accessCodes.ts`, `accessCodes.test.ts`, `catalogue.ts`, `market.ts`, `public.ts`,
`schema.ts`, `dashboard.test.ts`, `eft.test.ts`, `content/authoring.ts`, `topicAccess.ts` and
`vouchers.ts`.

**Three references were already wrong before this ticket**, stale since 16, and are corrected to
the module the symbol actually lives in:

- `convex/auth.ts:75` sent the reader to "`oauthRedirectUrl` in lib.ts". That function moved to
  `convex/authRedirect.ts` in 16. Now points there.
- `docs/architecture/contexts/01-hub-content.md`, `04-publishing-workspace.md` and
  `05-access-sharing.md` linked `getOwnedTopic` / `getViewableTopic` / `getEditableTopic` /
  `topicBySlug`, `topicLessonCounts`, `assertAdmin`, `pickContentBody` and `claimPendingShares`
  at `/convex/lib.ts`, several with line anchors (`#L7-L10`, `#L21-L40`, `#L46-L59`,
  `#L12-L17`) from before the split. Repointed to `topicAccess.ts`, `progressCounts.ts`,
  `adminSecret.ts`, `contentBlobs.ts` and `shareGrants.ts`, and the **line anchors were dropped
  rather than re-guessed**. `grantsFor` and `freePublishedLangs` in the same files now point at
  `edition.ts`.
- `convex/eft.ts`'s ponytail marker named `lib.ts` as `tenantBrand`'s hoist target.
  `docs/ponytail-debt.md` had already recorded that target as wrong; the comment now names
  `convex/tenantTheme.ts` and says never the Edition core, and the ledger's `eft.ts:473` and
  `eft.ts:56` rows were updated to match. The replacement kept the comment at three lines so the
  ledger's line anchors still land.

**Left alone, deliberately:**

- The **four ADR mentions** (`0023`, `0024`, `0030`, `0031`). This repo does not rewrite an ADR
  to correct it: a stale ADR gets a superseding one, and a file rename is nowhere near worth an
  ADR. They are dated records of what was true when decided, and `git log --follow
  convex/lib.ts` still resolves them.
- **`.plan/` maps, handoffs and other tickets.** All of them, including ticket 04's quotation of
  `convex/lib.ts` and ticket 20's ponytail-ledger rows, are records of what was true when
  written, and only ticket 17 was claimed. Ticket 04 carries a live pointer at
  `convex/lib.ts` in its Question, worth a line from whoever picks it up.

### Bug spotted, not fixed

None. No commit here changes behaviour, and nothing was found that does.

### Evidence

`pnpm typecheck` clean and `pnpm vitest run` green after the rename commit and again after the
prose commit: **87 files, 1045 tests passed**, identical to the baseline taken before the first
edit. This ticket's Done when is entirely compile-and-test checkable, so the evidence is a green
typecheck and suite, **not a browser walk**. Nothing was clicked, and nothing needed to be.

### Commits

- `817ee8e` refactor(convex): rename lib.ts to edition.ts
- `78a483f` docs(convex): repoint prose references from lib.ts to edition.ts
