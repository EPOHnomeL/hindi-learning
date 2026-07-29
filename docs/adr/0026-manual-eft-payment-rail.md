# A manual EFT payment rail beside PayFast

> Deliverable of [ywampotch-launch](../../.scratch/ywampotch-launch/PRD.md) part 2,
> grilled and agreed 2026-07-29, written after the confirm queue was real. Numbered
> 0026 because 0025 is [per-tenant session isolation](0025-per-tenant-session-isolation.md).

## Status

Accepted 2026-07-29. **Adds to** [ADR 0016](0016-paid-course-marketplace-stripe-connect-facilitator.md)
(the paid marketplace) and its PayFast pivot; supersedes nothing.

## Context

PayFast is live and has processed real purchases. The rail works. What does not
work is the funnel: the operator's diagnosis for the `ywampotch` launch was
**checkout abandonment** — buyers reaching the gateway and stopping there. PayFast
advertises nine Instant EFT banks but renders five on this account, so a buyer at
Absa, Standard Bank, Capitec or African Bank opens the picker, cannot find their
bank, and leaves. The paygate already carries a hardcoded note steering those
buyers to "Credit & Cheque card", which is a workaround for a wording problem, not
for the objection underneath it: *some buyers do not want to use a gateway at all.*

In South Africa the ordinary answer is a direct bank transfer. It costs the
operator nothing, clears in hours or days, and is how a great deal of small
commerce here is actually done. What it lacks is any automation: nobody tells the
platform the money arrived.

## Decision

**Add a second payment rail in which the buyer transfers the price directly into
the operator's account and a human confirmation grants access.** It runs beside
PayFast; neither knows about the other.

1. **The operator remains sole merchant-of-record.** The money lands in the
   operator's own account, exactly as PayFast settlement does. Sellers still never
   register a payment account, and payouts are unchanged: manual EFT out of the
   Ledger, through the existing Payouts tab. The rail changes *how money comes in*,
   not who holds it or who owes whom.

2. **A manual sale mints a real Ledger row**, at `fee: 0` with `net == gross`
   (no gateway took a cut), split 50/50 through the same `splitNet` as a card sale.
   This is the reason the confirm action is not the existing
   `market.grantEntitlement`: that path grants access and writes no Ledger row, so
   the sale would be invisible to the Sales tab and never `owed` in Payouts. **A
   sale the operator cannot see is a sale the Seller never gets paid for.** Access
   and money are minted in one transaction, mirroring `market.fulfillPurchase`.

3. **Provenance is carried by exactly one of `pfPaymentId` or `eftRef`** on every
   Entitlement and every Ledger row. Given any row you can always say which rail
   sold that seat. `ledger.pfPaymentId` was widened from required to optional to
   make room; there is no plan to narrow it back (narrowing needs the data stripped
   of the field in an earlier merge — `docs/agents/project-context.md`).

4. **The PayFast code path is untouched, deliberately**, and this is why EFT
   intents live in their own `eftIntents` table rather than in a widened
   `checkoutIntents`. `checkoutIntents` is read by the live ITN
   (`market.checkoutIntentByRef`, `market.fulfillPurchase`) and holds real
   purchases. Adding a status field and a reference to it would put a new feature's
   schema changes on the one code path that is currently moving money correctly. A
   separate table was also *less* code than widening. **A future simplification
   pass that merges the two tables is not tidying — it is putting the working money
   path back at risk. Do not do it without a reason better than symmetry.**

5. **The reference is the mechanism, and it is built for a human.** A short
   course-prefixed token (`TSW-4F2K`), minted from an alphabet with no I/1, O/0,
   S/5 or Z/2, unique per buyer per Edition, and idempotent: clicking twice returns
   the same reference. Deliberately *not* the PayFast `m_payment_id` UUID, because a
   person retypes this one into a banking app, and a mistyped reference is a payment
   that cannot be matched to anybody.

6. **The rail has one global on/off switch and one global collection account**, in
   a sys-admin-editable settings record — not per tenant, not per course, because
   the money lands in one account whichever tenant sold the course. A tenant admin
   cannot read or change it: moving where the platform's money is collected is not a
   subdomain administrator's call.

7. **The buyer is told twice.** In-app, a reactive pending state showing their
   reference (a paygate reappearing reads as "my payment failed"); and exactly one
   email on confirmation, deep-linked to the tenant's own host — under ADR 0025
   sessions are host-only per subdomain, so an apex link would land the buyer signed
   out in front of the paygate they just paid to pass. No email at intent time: it
   would tell the buyer nothing they do not already know.

## Consequences

- **Reconciliation is manual, per sale, forever.** The operator reads their bank
  statement, finds the reference, and clicks. There is no bank feed and no
  automatic matching. This is accepted, not deferred.
- **Access is only as fast as the operator's attention.** A buyer who transfers
  money on Friday night may wait until Monday. The pending state and the
  confirmation email exist to make that wait survivable rather than to shorten it.
- **Dismiss is a first-class action, not an error path.** Intents that never get
  paid are litter; without a way to clear them the queue silts up, stops being
  read, and that is how a real payment eventually gets missed.
- **Two rails can collide.** A buyer may pay by card while their EFT intent is
  still pending. The `(buyer, Topic, language)` idempotency means no second
  Entitlement is minted; sorting out the duplicate money is a manual job. The
  operator decided (2026-07-29) that this is rare enough to handle by hand, and
  that no code, branch or warning should exist for it.
- **A confirmed sale must never be undone by a side effect.** The email — including
  building its link — is best-effort inside the confirming mutation, because a
  throw there would roll back the grant and the Ledger row. An unprovisioned
  `SITE_URL` must not mean a deployment that silently refuses to confirm real
  payments.
- **Refunds are unchanged**: `market.revokeEntitlement` remains the only valve, and
  returning the money is out-of-band, like collecting it.
