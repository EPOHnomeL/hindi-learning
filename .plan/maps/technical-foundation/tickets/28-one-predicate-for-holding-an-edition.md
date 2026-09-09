---
type: task
blocked_by: []
---
# One predicate for "does this caller already hold this Edition?"

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 4), re-verified in
the tree on 2026-09-07.

The same question is answered in four shapes across four files, **and the shapes have
already drifted**:

- `edition.ts:32` `grantsFor`: shares + entitlements + enrollments + freePublished. The
  declared one place.
- `edition.ts:83` `hasEntitlement`: entitlements only. A second, narrower reader.
- `catalogue.ts:162` `heldPersonally`: three index reads, language ignored. A third.
- `vouchers.ts:247`: owner check + `hasEntitlement` + its own enrollments read. A fourth.

The drift is a live defect, not an aesthetic one. **`accessCodes.ts` `claimSeat` performs
no hold check at all** (verified 2026-09-07: it goes capacity check, then
`db.insert("seats")`, then `db.insert("entitlements")`), so a member who already owns the
Edition burns one of a capped Access Code's seats and gets a duplicate Entitlement.
`vouchers.redeem:247` refuses that identical case without consuming anything. Two rails,
opposite answers to the same question.

`edition.ts:152` `holdsSeat` also reads the `seats` table, which `accessCodes.ts` owns:
leakage pointing the wrong way out of the Edition core.

## Done when

The grant tables have one module whose interface is three predicates (`grantsFor`,
`permanentHold(topicId, userId, lang?)` and `holdsSeat`), and every caller asks one of
them instead of walking the tables itself. `claimSeat` stops double-granting, and that
fix has a test that fails without it. `edition.ts` keeps the reader, the paygate and
selection; the `seats` read leaves it.

`pnpm typecheck` and `pnpm test` green.

**No ADR conflict.** ADR 0031 requires the Entitlement row to carry no provenance. A
shared predicate reads rows and writes none, so that promise survives intact.

**Record separately, in the same session:** `enrollments` is read in four places and
**written nowhere in production code**; the only inserts are in tests. It is a
grandfathered-rows-only table now. Say so in `CONTEXT.md` before someone reasons from
ADR 0023 (self-enroll access primitive) as if self-enroll still writes. That is a
correction carrying an absolute date, not an ADR rewrite: ADR 0023 stands as the record
of what was decided and when.

**Note on test seeding:** `grant-resolver.test.ts:33,36` seeds by raw `db.insert`, so it
will not catch a caller that skips the new predicate. Consider whether the predicate
needs its own tests rather than relying on that file.

## Answer

2026-09-08, built. `convex/grants.ts` owns `shares`, `entitlements`, `enrollments` and
`seats`. The three table reads are named once and every predicate is composed from them,
**each staying as cheap as the copy it replaced**: `hasEntitlement` is still one index
read, `heldPersonally` still short-circuits per Catalogue card. `survivesTheOwner` gives
the voucher rail's wider question a name and says in one place why a Share does not count.
`grantEdition` and `revokeEdition` are the only writers, pinned by a boundary test scoped
to the two signatures that were actually duplicated.

`edition.ts` gave up the grant tables and `holdsSeat`. The Catalogue listing trio moved to
`convex/publishedEditions.ts`, below the grant walk, because `grantsFor` needs the
free-published set and leaving it in `edition.ts` would have made the two modules import
each other. That trap has bitten this repo twice, in 16 and 18.

**One claim in this ticket is wrong, and is corrected rather than carried.** It said
`claimSeat` handed an already-entitled member a duplicate `entitlements` row. It cannot:
`accessCodeAuth.ts` mints a fresh account per (code, nickname) and a returning nickname
short-circuits in `forJoin`, so the `userId` reaching `claimSeat` has never held anything.
The guard went in anyway, because the invariant was resting on an account-minting scheme
two files away, and a test drives the internal mutation directly to pin it here. **This was
not a live defect.**

`CONTEXT.md` records the dated correction this ticket asked for: nothing writes an
`enrollments` row any more. ADR 0023 stands as written; no ADR was rewritten.

Verified by test. `pnpm typecheck` and the full suite green.
