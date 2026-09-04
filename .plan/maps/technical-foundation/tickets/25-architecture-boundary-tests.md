---
type: task
blocked_by: []
---
# Nothing stops the next junk drawer forming

## Question

Graduated from this map's `## Not yet specified` on 2026-09-04, when the last of the
splits it was waiting on resolved.

The patch said this was too coarse to ticket "until the splits are done and the real seams
are known". They are done, all three on 2026-09-03 and 2026-09-04:

- [16](16-empty-lib-ts.md): `lib.ts` 855 lines to 623, seven modules out.
- [17](17-rename-lib-to-edition.md): the remainder renamed to `edition.ts`, 16 import
  sites.
- [18](18-split-tenants-ts.md): `tenants.ts` 738 lines to 149, four modules out.

**Those three fixed instances, not the pattern.** Nothing in the repo prevents the next
junk drawer: no size ceiling, no import-direction rule, and no test that fails when one is
broken. The seams are now known and named, which is exactly what the patch was waiting
for, so the question is finally sharp: **what boundary is worth enforcing mechanically,
and what enforcement is worth its own maintenance?**

Real material to work from, all of it produced by the splits:

- **A one-way import rule already exists in practice and only in prose.** 16 records that
  `topicAccess` imports `grantsFor` from `edition` and nothing comes back; 18 records that
  every edge points one way out of `tenants.ts`. Both are asserted in an `## Answer` and
  enforced by nothing.
- **`edition.ts` is a sink and must stay one.** `docs/ponytail-debt.md` judged an
  `eft.ts` marker's proposed hoist INTO `lib.ts` wrong precisely because 16 was emptying
  it. That judgement lives in a ledger a future session may not read.
- **A size signal exists but no threshold.** `AdminPanel.tsx` at 2617 lines and
  `translate.ts` at 1233 ([24](24-split-translate-ts.md)) are the current worst; 623 and
  149 are the post-split shapes. Nobody has said what number is too big.

The laziest thing that could work is one test, in the spirit of
[23](23-tenant-token-mirror-has-no-test.md): that ticket proved a hand-mirrored constant
could be held to its canonical source by a single assertion rather than a refactor. Read
it before reaching for a tool or a dependency, and read `/ponytail` before adding either.

## Done when

A decision on what to enforce and how, recorded either way, including "nothing, and here
is why" if that is the honest answer. If something is enforced, it fails on a real
violation, and that failure has been demonstrated rather than assumed, the same bar 23
was held to.
