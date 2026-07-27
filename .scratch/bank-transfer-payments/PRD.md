# PRD: Bank transfer payments — regional **Collection accounts** + manual approval

Status: in progress

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Entitlement**, **Edition**,
> **Ledger**, **Seller**, **Preview**, **Admin**, plus the two terms this PRD adds:
> **Collection account** and **Bank transfer**. Builds on
> [`../payfast-payments/PRD.md`](../payfast-payments/PRD.md) (the PayFast rail) and
> [ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)
> (the marketplace shape). The **access model is unchanged** — an Entitlement is
> still the sole holder of paid read access, and the Edition access resolver is
> untouched. This adds a second way to *collect* the money.

## Problem Statement

Today the only way to buy a paid Edition is PayFast's hosted checkout: a card or
Instant EFT payment into the operator's single South African merchant account,
with access granted automatically by the verified ITN. That rail has two hard
limits:

1. **It is South-Africa-only.** PayFast settles in Rand into an SA merchant
   account, and its Instant EFT bank list is SA banks. A buyer in India has no
   usable payment method — the card tile is the only option and cross-border card
   acceptance on a ZAR merchant account is exactly where those payments fail.
2. **There is no manual money path at all.** If a buyer transfers money by hand —
   the normal way people pay across borders — nothing in the app can turn "the
   money arrived" into access. The only tool is `market.grantEntitlement`, an
   Admin-only comp grant with no record of *which* payment it was for.

The operator wants to hold **regional bank accounts** (one in India to start) and
sort the inter-border movement of that money out themselves, out of band. What
the app has to provide is the bookkeeping either side of that: give the buyer an
account to pay into and a **reference number** to quote, store that reference
against the Edition and the buyer's email, and let the course owner approve the
reference once they see the money land — which is what finally grants access.

## Solution

Add a second, **manual** payment method alongside PayFast: pay by bank transfer
into one of the course owner's **Collection accounts**, granted on approval.

- **The course owner sets up their Collection accounts in-app** — one per region
  (label, country, currency, account holder, bank, account number, a regional
  routing code, optional SWIFT, and free-text instructions). No external
  onboarding, exactly like the existing payout bank details. An account can be
  disabled (hidden from buyers) without deleting its payment history.
- **A buyer on a paid Edition can choose "Pay by bank transfer"**, pick the region
  closest to them, and gets back the account's full details plus a short,
  human-transcribable **reference** (`MC-XXXX-XXXX`). The reference is the record:
  a `bankTransfers` row holding the reference, the Edition (Topic × language), the
  buyer's **account email**, the price frozen at request, and which Collection
  account was named. Requesting grants nothing.
- **The course owner (or the Admin) approves the reference** once the money shows
  up in that account. Approval is the grant: it mints the **Entitlement** for that
  Edition onto that account and writes the sale's **Ledger** row, in one
  transaction — the same "money in + what it means" seam `fulfillPurchase` has.
  Decline is the other terminal state, with a reason the buyer sees.
- **Bank transfer is independent of the PayFast rail.** It works while
  `PAYFAST_MODE=off` and on a deployment with no PayFast credentials at all, so a
  blocked merchant account never takes the whole marketplace down. (Pricing an
  Edition is still PayFast-gated — that guard is untouched by this PRD.)

## User Stories

1. As a **course owner**, I want to add a bank account per region (e.g. one in India, one in South Africa), so that a buyer can pay into an account local to them.
2. As a course owner, I want each Collection account to carry its own currency and regional routing code (IFSC, branch code, sort code), so that the details I show a buyer are the ones their bank actually asks for.
3. As a course owner, I want to add free-text instructions to an account ("quote the reference in the remarks field"), so that a buyer's payment arrives identifiable.
4. As a course owner, I want to disable a Collection account without deleting it, so that new buyers stop being offered it while its past payments keep their history.
5. As a course owner, I want to correct an account's details, so that a changed bank never strands buyers.
6. As a **buyer** on a paid Edition, I want "Pay by bank transfer" offered next to the card checkout, so that I can buy when card payment isn't an option for me.
7. As a buyer, I want to choose the region I'm paying from, so that I make a local transfer instead of an international one.
8. As a buyer, I want the account's full details and a **reference number** to quote, so that my payment can be matched to my purchase.
9. As a buyer, I want the same reference back if I return to the page, so that I never end up with two open payments for one Edition.
10. As a buyer, I want to see that my payment is awaiting confirmation, and see it flip to unlocked the moment it's approved, so that I know where I stand without emailing anyone.
11. As a buyer, I want to be told why a payment was declined, so that I can fix it rather than guess.
12. As a **course owner**, I want to see every bank transfer awaiting my approval across all my courses — reference, course, Edition, buyer email, amount, account, and when it was requested — so that I can match them against my bank statement.
13. As a course owner, I want approving a reference to grant that buyer access to exactly the Edition they paid for, so that approval is the only step between money and access.
14. As a course owner, I want to record what actually arrived when the amount differs (a cross-border FX difference, a bank charge), so that the Ledger records the real money, not the sticker price.
15. As a course owner, I want to decline a reference with a reason, so that a payment that never arrived is closed rather than left open forever.
16. As the **Admin**, I want the same approve/decline over every course's transfers, so that I can act when an owner can't.
17. As the operator, I want each approval to write a Ledger row, so that a bank-transfer sale appears in the sales report exactly like a PayFast sale.
18. As the operator, I want approval to be idempotent, so that a double-click or two people approving at once can never double-grant or double-write the Ledger.
19. As the operator, I want a buyer's bank details read to be scoped to their own transfer, so that a guessed reference reveals nothing.
20. As the operator, I want bank transfers to keep working while PayFast is paused or unconfigured, so that a blocked merchant account doesn't close the marketplace.

## Implementation Decisions

- **Access is unchanged.** No change to `editionAccessLevel`, the readers, the
  Preview, or the paywall. Approval mints an ordinary **Entitlement** row; every
  downstream behaviour (Viewer-equivalence, own Progress, Certificate eligibility,
  per-Edition scoping) follows for free.
- **Two new tables, one new module.** `bankAccounts` (owner-level, one row per
  region) and `bankTransfers` (one row per requested payment) in `schema.ts`; all
  the behaviour in `convex/bankTransfer.ts`. Nothing in `market.ts`/`payfast.ts`
  changes except two widened schema fields (below).
- **The reference is the identity of a payment.** `MC-XXXX-XXXX`, 8 symbols from a
  31-char unambiguous alphabet (no I, O, 0, 1) so it survives being read off a
  screen and typed into a banking app. Minted with a uniqueness re-roll. It is
  *not* a bearer capability like `m_payment_id` — being short, it is guessable, so
  every read of a transfer is authorised by identity (the buyer's own email, the
  Topic owner, or the Admin), never by possession of the reference.
- **Requesting is auth-first** (ADR 0021), like `startCheckout`: the buyer must be
  signed in and the email is their **account's**, never an argument. Approval
  therefore mints straight onto a real account — there is no pending-Entitlement
  path to build.
- **One open transfer per (buyer, Edition).** A repeat request returns the existing
  `awaiting` row's reference, re-pointing it at a newly-chosen Collection account
  if the buyer switched region. Two open references for one Edition would be two
  payments the owner has to reconcile.
- **The price is frozen at request**, as `checkoutIntents.amount` is at Buy — a
  re-price between "here are the bank details" and the money arriving must never
  invalidate a genuine payment.
- **Bank details are shown only to the buyer who asked.** The picker query returns
  label/country/currency only (no account numbers); the full details come back
  only with the caller's own transfer. So a paid Edition's page can't be scraped
  for the owner's bank accounts.
- **Approval writes the Ledger, in the same transaction as the grant.** Same seam
  and the same shape `fulfillPurchase` uses: `gross`/`fee`/`net` in cents, net split
  by `splitNet(net, platformFeeBps())`. `fee` is 0 by default (no gateway takes a
  cut) and the approver may record what actually arrived, so a cross-border
  shortfall lands in the Ledger as the real number.
- **A bank-transfer Ledger row is written `status: "paid"`, `payoutRef` = the
  reference.** The money went *directly into the course owner's own account*, so
  the operator owes them nothing to EFT — writing it `owed` would invite a double
  payout. The row still exists, so `sales.report` counts the sale like any other.
  *(Known gap: the platform's 50% of a bank-transfer sale is money the seller owes
  the platform, which the Ledger has no column for. A non-issue while the operator
  is effectively the only Seller — the same posture the PayFast PRD takes on the
  aggregator question. Flagged, not built.)*
- **Two widened schema fields, no migration.** `ledger.pfPaymentId` becomes
  optional (a bank-transfer sale has no PayFast payment) and both `ledger` and
  `entitlements` gain an optional `bankTransferRef`, so a row's provenance is
  always exactly one of the two rails. Widening a required field is safe for every
  existing row.
- **Idempotence is the row's own status.** Approval/decline only act on an
  `awaiting` row and patch it terminal in the same transaction as the mint, so a
  replay is a no-op — no separate events table is needed (`payfastEvents` exists
  only because PayFast re-delivers ITNs; nobody re-delivers a button click).
- **Independent of the PayFast rail.** `bankTransfer.ts` never calls
  `sellingEnabled()`. Bank transfer is offered when the Edition is priced *and*
  its owner has an enabled Collection account — no env var, no network, no gateway.

## Testing Decisions

**What makes a good test here:** assert what a caller can *do* at the seam — the
access a buyer has before and after approval, who may approve, what the Ledger
records, what a non-owner can read — never internals or UI. Nothing here touches
the network, so there is nothing to mock.

- **Seam — the reference (pure).** The minted shape (`MC-XXXX-XXXX`), the
  unambiguous alphabet, and uniqueness across a batch.
- **Seam — Collection account CRUD.** Owner-scoped: a caller only ever sees/edits
  their own; validation rejects a blank holder/bank/number and a bad currency;
  disable hides from the buyer picker but keeps the row.
- **Seam — requesting a transfer.** Signed-in only; refused on a free Edition, on
  an account belonging to another owner, and on a disabled account; the email and
  amount come from the account/listing, not the argument; a repeat returns the
  same reference and can switch account.
- **Seam — the buyer's read.** The caller's own transfer returns full bank details;
  another signed-in user reading the same reference gets nothing.
- **Seam — approval (the grant).** Before: the buyer resolves to `preview` and a
  non-Preview Lesson is locked. After the owner approves: `entitled`, the Lesson
  reads, and the Ledger row records gross/fee/net + the 50/50 split, `paid`, with
  `payoutRef` = the reference. Re-approval is a no-op (one Entitlement, one Ledger
  row). Admin may approve; an unrelated user may not. Decline records the reason
  and grants nothing.
- **Seam — the approval queue.** An owner sees only their own courses' awaiting
  transfers; the Admin sees every course's.
- **Seam — rail independence.** Every one of the above passes with no PayFast env
  vars set.

## Out of Scope

- **Automated bank-statement matching / bank feeds.** Approval is a human reading
  their statement; that is the whole point of the reference.
- **Currency conversion.** The listing price stays ZAR-only. A Collection account
  in another currency shows the buyer the ZAR amount and its own currency, and the
  approver records what actually arrived. No FX rate lives in the app.
- **Guest (account-less) bank transfers.** Buying is auth-first (ADR 0021); a
  pending, email-keyed bank transfer claimed at sign-up is not built.
- **Reminders / expiry.** An awaiting transfer stays awaiting until a human closes
  it. No cron, no nudge emails.
- **Platform-share reconciliation** for bank-transfer sales (see the known gap
  above) and **automated payouts**.
- **Refunds.** Unchanged: manual Admin `revokeEntitlement` is the only valve.
- **Per-region pricing.** One price per Edition, as today.
