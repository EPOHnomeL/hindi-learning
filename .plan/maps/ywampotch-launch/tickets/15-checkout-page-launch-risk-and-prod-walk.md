---
type: task
blocked_by: [13, 14]
---

# Launch risk — rollback story and the prod walk-through

> `/wayfinder .plan/maps/ywampotch-launch/tickets/15-checkout-page-launch-risk-and-prod-walk.md`

## Question

This strand replaces the entry to the surface every Rand flows through, days
before YWAM Potch goes live, on a repo where pushing `main` deploys prod. Five
real purchases have already completed through the old dialog. That earns an
explicit risk pass rather than a hope.

- **Rollback.** If the checkout page is broken on prod at 9pm, what is the
  fastest safe undo? A revert of the strand's commits, or a flag that falls back
  to the dialog? (A flag means keeping `BuyDialog` alive, which ticket 13
  deliberately deletes — so this is a real trade, not a free safety net.)
- **The walk-through, on prod, on a real phone**, both entry paths and both
  rails: share link → sign in → page → EFT reference and bank details; and
  signed-in → page → PayFast redirect. This is the same walk ticket 07 needs;
  do them together rather than twice.
- **What breaks quietly.** The PayFast return redirect and the payment-return
  banner in `CourseShell` both assume where a buyer came from. Confirm the
  return lands somewhere sensible from the new route.
- **The other tenants.** Ticket 14 touches `SignIn`, which every signed-out
  visitor on every tenant sees. Check one non-YWAM tenant's signed-out view
  before this is called done.

## Done when

A rollback route is decided and written down. The full walk-through is done on
prod, on a phone, both entry paths and both rails, and the operator has signed
off. The PayFast return lands correctly from the new route. One non-YWAM tenant's
signed-out view is confirmed unbroken.

## Answer

**The ticket's premise was already out of date: the checkout page is on prod and
has been since this afternoon.** `f971945` (13), `14b3888` (16) and `f8b55c3`
(17) all rode the push that built prod deployment `344c933`. Only **`00c78c5`**
— ticket 14's 320px phone pass — is unpushed, along with its map commit. So the
question was never "should we take this risk", it was "what is the undo for a
risk already taken".

**Decided: no rollback is armed. Forward-fix is the policy** — the operator's
call, made on the evidence below, and the strand stays on prod. The escape hatch
is written down here anyway so a 9pm panic doesn't have to rediscover it, but it
is a hatch, not a plan.

**The hatch, if it is ever needed: Vercel instant rollback, not git, not a flag.**
Vercel offers exactly **one** rollback target — `dpl_A2qJk7PTskafVWH5tHudB9fEM5yW`
= `ae3f1d3` (2026-07-31 17:25), which is **pre-strand**: no `CheckoutPage.tsx`,
the purchase still inside `Paygate.tsx`'s dialog. Every older deployment reports
`isRollbackCandidate: false`. One click, seconds, and — this is the load-bearing
part — **safe against Convex**, because the whole strand's backend surface is
`convex/eft.ts` `+57/-1`: one additive, read-only `myPendingIntents` query. An
older frontend simply never calls it, and a Vercel rollback doesn't re-run the
build so Convex stays forward regardless. Pending `eftIntents` rows survive and
the old dialog still reads them through `myEftIntent`, so no in-flight buyer is
stranded by the rollback itself.

Its cost, named honestly: `ae3f1d3` predates 16 and 17, so rolling back
**reinstates the EFT dead end and removes the payment-complete moment**. It is a
retreat to known-degraded, not to known-good.

The two alternatives are both dominated. **A `git revert`** is four commits and
~15 files with `CheckoutPage`/`Paygate` touched three times over, reverting
`convex/eft.ts` re-strands pending EFT buyers, and a concurrent session has
`convex/` dirty on `main` right now — that is morning cleanup, not a 9pm undo.
**A flag over a resurrected `BuyDialog`** is strictly worse than the rollback: its
flag-off path *is* the pre-16/pre-17 dialog, so it buys nothing the rollback
doesn't, and charges ~337 restored lines plus two live checkout implementations
on the money surface in launch week.

**Standing caveat.** The single rollback candidate was read at this moment. Any
further push may move it — before pushing `00c78c5`, note the target in the
Vercel dashboard and re-check after the build that a pre-strand candidate is
still reachable. If it isn't, the hatch narrows to `git revert`.

### What breaks quietly — checked in code, and it doesn't

The PayFast return is **independent of the checkout route by construction**. The
URL is minted server-side at `convex/market.ts:433` to
`/courses/<slug>[?lang=]&purchase=return&mp=<token>` on the tenant's own host via
`appUrl` — it has never mentioned checkout and doesn't now. Traced the whole
landing:

- `/courses/<slug>` client-redirects *deeper*, to the resume lesson, via
  `courseIndexRedirect` (`src/app/_components/readerDerive.ts:23-29`), which
  rebuilds the query string and deletes only `lang`. `purchase=return&mp=…`
  survives verbatim.
- `CourseShell` lives in the layout, so it stays mounted across that `replace`
  and reads the params at `CourseShell.tsx:86-89`. The `welcomeVariant` panel
  from ticket 17 fires *after* the hop, as designed.

**One correction to ticket 12, which the map repeats.** 12 recorded `cancel_url`
as dropping an abandoning buyer "on the bare course index", accepted as a wart.
It doesn't: `cancelUrl` is `appUrl(back, …)` at `market.ts:434` where `back` is
`/courses/<slug>` — the course page itself. A non-owner landing there gets the
free Preview lesson with a fully populated table of contents, lock icons on the
rest, and `LockedPane` + `Paygate` on any locked item. The wart is smaller than
recorded and needs no fix.

**A latent edge found in passing, not reachable today and not ticketed.**
`resumeLessonKey` (`readerDerive.ts:54-63`) doesn't filter on `locked`, whereas
`startLesson` (`CourseShell.tsx:164-166`) does. It's masked because progress is
never written for a `preview` caller (`ArtifactView.tsx:440`), so a non-owner has
no rows and always resolves to lesson 1. If an Entitlement ever lapses *after*
progress exists, `/courses/<slug>` would redirect onto a locked lesson — a
paygate card, so still not broken, just not the Preview. Recorded rather than
charted: nothing in this map's destination can produce a lapsed Entitlement.

### The other tenants — cosmetic risk only

Re-read `00c78c5`'s `SignIn.tsx` diff line by line: `min-h-screen`→`min-h-svh`,
`py-8`, `gap-5 sm:gap-6`, logo `h-14 sm:h-16`, `h1` `text-xl sm:text-2xl`, the
rail box `px-2 sm:px-4`, card `p-5 sm:p-6`, `py-2` → `py-2.5` on the three
controls, `py-1` on the text link. **Every hunk is a class string.** No auth
change, no logic change, no conditional. So the leak onto `upf`,
`almighty-warriors`, `yknot` and the apex is real but cannot be functional — the
prod look-see is confirmation, not a gate.

### The walk is not done, and it is now its own ticket

Three of this ticket's four clauses are settled above. The fourth — the
prod walk on a real phone — is the operator's and cannot be an agent's. It is
also **blocked on a sequencing fact this ticket surfaced**: ticket 14's phone
pass isn't on prod, and pushing it *is* the deploy. The operator chose **walk
prod as-is first, push `00c78c5` after**, which keeps the known rollback target
untouched during the first pass.

That walk also owes 13, 16 and 17, all of which stand "operator's walk pending".
Collected into **[18](./18-operators-prod-walk.md)** rather than left scattered:
one walk, one sign-off, one place it's recorded.

<!-- Resolved 2026-08-01. Rollback decided AFK on deployment + git evidence;
     the operator chose forward-fix and the walk order. -->

