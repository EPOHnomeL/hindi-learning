---
type: task
blocked_by: []
---
# Split `convex/translate.ts`

## Question

Graduated from this map's `## Not yet specified` on 2026-09-04, when
[20](20-ponytail-debt-ledger.md) resolved and answered the question the fog patch was
waiting on.

`convex/translate.ts` is **1233 lines**, verified 2026-09-04, and it is now the largest
file in `convex/` by a wide margin: [16](16-empty-lib-ts.md) took `lib.ts` from 855 to
623 and [18](18-split-tenants-ts.md) took `tenants.ts` from 738 to 149, so nothing else
is close.

**What the fog patch was waiting for, and what it got.** The patch could not say whether
this file wanted the 16-and-18 treatment or something else, because its two `ponytail:`
markers might have been load-bearing. The ledger settled that: both came back
**ACCEPTED**, not deferred debt.

- `translate.ts:105`, Q&A translation dropped in the routine cut-over: a scoped-out
  feature with a named trigger (learner demand), not an accident.
- `translate.ts:670`, the translation lock table fully scanned: a bounded table, one row
  per Topic and language, whose fix is a one-line `by_status` index when it stops being
  bounded.

So this is **a size problem and not a debt problem**, which is what makes it a plain
mechanical split rather than a grilling ticket. Do not fix either marker here; the ledger
accepted them and `docs/ponytail-debt.md` is where that call lives.

## Done when

The concerns in `translate.ts` have real module boundaries, no behaviour changes,
`pnpm typecheck` and `pnpm test` green.

Same discipline as 16 and 18, whose Answers are the precedent to follow: moves never share
a commit with behaviour changes, several small commits rather than one large one, no
re-export shims left behind, the suite green after **every** commit, and
`convex/_generated/api.d.ts` committed alongside whichever module changes it. Read both
Answers before starting. Note especially 16's circular-import lesson (it had to extract a
shared root first) and 18's variant of it (a duplicated helper deleted in favour of the
shared one, landed alone, before any move).

**One thing to check that 16 and 18 did not have to:** `translate.ts` may register public
Convex functions, and moving one changes its `api.` path, which is a deploy-window
breaking change for any client still running the previous bundle. 18 moved 16 such
functions and the window was accepted knowingly. Count them first and say in the Answer
whether this split carries the same cost.
