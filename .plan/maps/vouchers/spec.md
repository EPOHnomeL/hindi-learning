# Spec: the voucher rail

<!-- Written 2026-08-18 from a /grilling session. The design decisions are recorded in
     ADR 0029 (docs/adr/0029-seller-minted-voucher-rail.md) and the Voucher /
     Voucher Batch glossary terms in CONTEXT.md; this spec is the build contract, not
     the decision record. Where the two disagree, the ADR wins and this file is stale. -->

## Problem Statement

An organisation wants to buy course access for a group of its people, and **will not hand over
their email addresses**. The first real prospect is a political party that treats its membership
list as something it does not give to third parties.

Today that organisation cannot be served at all. Every way access is granted needs the holder
identified up front:

- `market.grantEntitlement` takes one email at a time, typed by an Admin. A hundred seats is a
  hundred emails the party refuses to supply, entered by hand.
- Both payment rails are **auth-first** ([ADR 0021](../../../docs/adr/0021-open-signup-allowlist-gates-course-creation.md)):
  the buyer must be signed in and the purchase attaches to *that* account. One account cannot buy
  a hundred seats.
- A **Share** is granted to a named address, so it has the same problem as a comp.

The Seller in the middle of the deal also has no way to transact it. They negotiate a bulk price
with the organisation, but they cannot issue anything, and the platform has no record of the money.
Either the deal does not happen, or it happens off-platform and the Seller's 50% is settled on
trust with no Ledger row.

## Solution

The **Seller** mints a **Voucher Batch**: N single-use codes for one **Edition** of their own
course, at the total they negotiated. The codes work immediately. The Seller downloads them as a
CSV and hands them to the organisation, which distributes them however it already talks to its
people. The platform sends nothing and never learns who the members are.

A member opens `/redeem`, creates an account with **an email of their own choosing**, enters the
code, and gains permanent access to that Edition. The organisation never sees who redeemed; nor
does the operator. The only thing anyone can see is a count.

The money follows the rail that already exists. The organisation transfers the total into the
**operator's** account — the operator remains sole merchant of record
([ADR 0026](../../../docs/adr/0026-manual-eft-payment-rail.md)) — and the **sysadmin** logs the
reference against the batch, which is what makes the Seller's 50% payable. The sysadmin never sees
or touches a code.

## User Stories

**The Seller selling the batch**

1. As a Seller, I want to mint a batch of voucher codes for one Edition of my own course, so that
   I can sell access to an organisation that will not give me its members' email addresses.
2. As a Seller, I want to state the number of seats and the total price I negotiated, so that a
   bulk discount needs no discount machinery and no approval from the operator.
3. As a Seller, I want to record the buying organisation's name and billing contact on the batch,
   so that I and the sysadmin can tell one batch from another months later.
4. As a Seller, I want the codes to work the moment I create the batch, so that I can close a deal
   and hand over codes in the same meeting without waiting on the operator.
5. As a Seller, I want to download my batch's codes as a CSV, so that I can print them, mail-merge
   them, or paste them into whatever channel the organisation uses.
6. As a Seller, I want to see how many of a batch's codes have been redeemed, so that I can tell
   the organisation their take-up without ever learning who took it up.
7. As a Seller, I want to be told plainly that a batch's money has not yet been logged, so that I
   know my share is not payable yet and why.
8. As a Seller, I want to void a batch, so that a deal that went wrong stops handing out new seats.
9. As a Seller, I want minting to be refused unless I hold the can-sell capability and have saved
   payout details, so that the platform never issues seats it cannot pay me for.
10. As a Seller, I want to be refused if I try to mint a batch for a course I do not own, so that
    nobody can sell my Editions and I cannot sell theirs.

**The member redeeming**

11. As a member of the organisation, I want to redeem a code at a single obvious address, so that I
    can get in from a link in a group chat without being told to find the right subdomain.
12. As a member, I want to sign up with any email address I choose, so that joining a course does
    not require my organisation to have disclosed my details.
13. As a member, I want my access to be permanent once redeemed, so that it behaves like the course
    I would have bought myself.
14. As a member, I want to redeem while signed out and be brought back to the code afterwards, so
    that creating an account does not lose my place.
15. As a member, I want a clear message when a code has already been used, so that I know to ask
    the organisation for another rather than assuming the site is broken.
16. As a member, I want a clear message when a code does not exist, so that I can tell a typo from
    a dud.
17. As a member who already owns or is enrolled on that Edition, I want to be told I already have
    access and to have my code left unused, so that I can pass it to somebody who needs it.
18. As a member, I want redemption to attach access to the account I am signed into, so that
    nobody can redeem a code onto an address they do not control.

**The sysadmin handling the money**

19. As the sysadmin, I want a queue of batches whose money has not been logged, so that I can
    reconcile them against the bank statement in one place.
20. As the sysadmin, I want to log the bank reference or transaction ID against a batch, so that
    the Seller's share becomes payable and the payment is traceable to a statement line.
21. As the sysadmin, I want the batch's Ledger row to be invisible to payouts until I have logged
    the cash, so that I never pay a Seller a share of money nobody received.
22. As the sysadmin, I want one Ledger row for the whole batch rather than one per seat, so that
    the sales report reads as the single commercial event it was.
23. As the sysadmin, I want no ability to mint or read codes, so that the boundary between the
    money role and the selling role is enforced rather than merely conventional.
24. As the sysadmin, I want to see the batch's seat count and total, so that I can check the total
    against what landed before I log it.

**The buying organisation**

25. As the buying organisation, I want to receive codes without giving anyone a list of my members,
    so that a course purchase does not become a data disclosure.
26. As the buying organisation, I want to know how many seats have been taken up, so that I can
    chase my own people without the platform telling me who they are.
27. As the buying organisation, I want no account and no login, so that adopting this creates no
    new system for me to administer.

**The operator protecting the model**

28. As the operator, I want a voucher-granted Entitlement to be indistinguishable from an Admin
    comp, so that the anonymity promised to members is a property of the data and not of a UI that
    chooses not to show it.
29. As the operator, I want all the money to land in my account, so that I remain sole merchant of
    record and the platform's 50% is arithmetic rather than trust.
30. As the operator, I want redemption to be impossible for a Guest, so that access continues to
    attribute to an account exactly as an Entitlement always has.

## Implementation Decisions

**Two new tables.** `voucherBatches` and `vouchers`, in `convex/schema.ts`.

- A batch row holds the Edition it sells (`topicId` plus `lang`), the Seller who minted it, the
  seat count, the agreed total in cents, the buying organisation's name and billing contact as
  plain strings, its `ledgerId`, and a voided marker. There is **no organisation entity** and no
  redemption counter — counts are derived by counting voucher rows.
- A voucher row holds its `batchId`, its `code`, and an optional `redeemedAt`. It holds **no user
  id**. Absent `redeemedAt` means unredeemed; that is the whole state machine.
- Indexes: vouchers `by_code` (the redeem lookup, unique in practice) and `by_batch` (the CSV and
  the count); batches `by_seller` (the Seller's list) and one for the sysadmin's unpaid queue.

**One new Convex module, `convex/vouchers.ts`** — the single new seam. Its surface:

| Function | Caller | What it does |
| --- | --- | --- |
| `mintBatch` | Seller | Creates the batch, its N vouchers and its Ledger row in one mutation. |
| `myBatches` | Seller | The Seller's batches with derived redeemed counts and payment state. |
| `batchCodes` | Seller | The codes for one of the caller's own batches; the CSV's source. |
| `pendingBatches` | sysadmin | Batches with no cash logged. Returns totals and seat counts, **never codes**. |
| `logBatchPayment` | sysadmin | Records the reference and flips the Ledger row to `owed`. |
| `voidBatch` | Seller | Marks the batch voided; unredeemed codes stop working. |
| `redeem` | any signed-in user | Validates the code and mints the Entitlement onto the caller. |

**The Ledger gains a third status, not a new field.** `ledger.status` becomes
`unpaid | owed | paid`. `ledger.owedPayouts` reads the `by_status` index for `"owed"`, so an
unpaid batch is excluded from payouts **with no change to that query's logic** — only its `kind`
returns-validator widens. This is why the guard is a schema widening rather than a filter someone
could later forget to apply.

**The Ledger gains a third `kind`**, `"batch"`, on the existing optional union. That field was made
explicit precisely so a third money source would not be foreclosed, so this is the anticipated
change and not a widening against the grain. A batch row carries `fee: 0` (no gateway took a cut),
`gross` equal to the negotiated total, the standard 50/50 split, `sellerId` equal to the minting
Seller, and `buyerEmail` equal to the **organisation's** billing contact. It carries neither
`pfPaymentId` nor `eftRef`; its provenance is the batch that points at it.

**Minting authorisation** reuses the existing two gates verbatim: a `sellers` row must exist (the
Admin's can-sell grant) **and** it must carry saved `payout` details. Plus the Seller must own the
Topic, and the Edition must be **published**. It need not be **priced** — the Seller states the
total, so a listing price is irrelevant to a batch.

**Redemption is auth-first and takes no email.** `redeem` accepts only a code and reads the caller
from `ctx.auth`. It refuses a Guest. It never accepts an email argument, because that is exactly
the impersonation hole ADR 0021 closed by deleting `pendingEntitlements` and claim-on-sign-up.

**Redemption refuses without consuming** in every case where it would grant nothing: the caller
already holds an Entitlement for that Edition, holds a grandfathered Enrollment on it, or owns the
course. The code stays redeemable. This mirrors `grantEntitlement`, which already treats a
duplicate as a no-op.

**The minted Entitlement carries no voucher provenance.** No batch id, no voucher id, no
`pfPaymentId`, no `eftRef` — the same shape an Admin comp writes. This is load-bearing, not an
omission: it is what makes the anonymity a property of the data. See ADR 0029 for the costs
accepted in exchange.

**No expiry, anywhere.** Vouchers have no expiry field. Voiding a batch is the only stop, and it
stops unredeemed codes only.

**Code format** `MYC-7K4Q-2XR9`: three groups, from a 32-character alphabet excluding `O`, `0`,
`I` and `1` so a code survives being read aloud over a phone or written on a card. Generated
server-side; collisions retried on insert.

**One route, `/redeem`, on every host, with no tenant flag.** The code names the Edition and that
binding is what authorises access, so the hostname is irrelevant. Gating it per tenant would tell
a member with a valid code that it is invalid because they followed the wrong link, which is the
worst available error for this audience.

**UI surfaces**: a batch section in the Seller's existing selling area (mint form, list with
derived counts, CSV download, void); a batch queue for the sysadmin beside the pending EFT intents
view (totals and references, no codes); and the `/redeem` page, which must work signed out by
routing through sign-up and returning to the entered code.

## Testing Decisions

**What makes a good test here.** Assert only what a caller can observe through the Convex function
boundary: what a query returns, whether a mutation throws, and what rows exist afterwards. Never
assert on how a code was generated, how the mutation is structured internally, or on component
markup. Every authorisation rule is asserted as a **server-side negative** — the test proves the
mutation throws for the wrong caller, not that a button is hidden, which is the pattern
`convex/eft.test.ts` states explicitly for the operator bank editor.

**Prior art to follow: `convex/eft.test.ts`.** It uses `convexTest` with `import.meta.glob`,
`t.withIdentity({ subject: "<userId>|session" })` to act as a user, and seeds fixtures **only as
production writes them** — `users` rows as auth writes them, `whitelist` rows as
`whitelist.seedEmail` / `scopeToTenant` write them (sys admin is `isAdmin` with no slug, tenant
admin is `isAdmin` plus a slug) — and never hand-seeds a row that a mutation is the sole writer of.
A voucher test must never hand-insert a `vouchers` row: it mints a batch through `mintBatch` and
reads the codes back, so the test exercises the only writer that exists.

**`convex/vouchers.test.ts` covers:**

- Minting creates N vouchers and exactly **one** Ledger row, at `status: "unpaid"`,
  `kind: "batch"`, `fee: 0`, the 50/50 split on the stated total, and `buyerEmail` equal to the
  organisation's.
- Minting negatives: no `sellers` row; a `sellers` row with no payout details; not the Topic's
  owner; an unpublished Edition; a sysadmin attempting it.
- Redeeming happy path mints an Entitlement for the caller, and that Entitlement has **no**
  `pfPaymentId`, **no** `eftRef` and no voucher field — asserted positively, because it is the
  privacy promise and a future refactor that adds provenance must fail a test.
- Redeeming sets only `redeemedAt`, and the voucher row holds no user id.
- Redeeming as a Guest throws.
- A second redemption of the same code throws and changes nothing.
- Redeeming an Edition the caller already holds (Entitlement, then Enrollment, then ownership)
  throws **and leaves `redeemedAt` unset** — the refuse-without-consuming rule, three ways.
- A voided batch's unredeemed codes throw; already-redeemed seats are untouched.
- Codes work regardless of the batch's payment state — the cash log is not a gate.
- `batchCodes` refuses a Seller asking for another Seller's batch; `pendingBatches` returns no
  codes and refuses a non-sysadmin; `logBatchPayment` refuses a Seller.

**`convex/ledger.test.ts` gains:** an `unpaid` batch row does not appear in `owedPayouts`; after
`logBatchPayment` the same row does appear, grouped under the Seller with the right share; and a
`"batch"` row passes the widened returns validator alongside `sale` and `donation` rows.

**Not tested**: the CSV download and the redeem page's markup. UI is covered through the Convex
seam, consistent with the rest of the repo.

## Out of Scope

- **Any organisation entity, login or dashboard.** The buyer is two strings on a batch. Revisit
  only if a buyer asks to self-serve repeat batches.
- **Card checkout for batches.** The money arrives by bank transfer against a reference; there is
  no PayFast flow for a batch.
- **Multi-use codes, unlimited codes, and expiry dates.** All three were considered and rejected
  (ADR 0029).
- **Discounts on the normal paygate.** A voucher grants the whole Edition; it is not a coupon and
  must never grow into one.
- **Emailing codes to recipients.** The platform has no member addresses and that is the point.
- **A printable voucher-sheet PDF.** Wanted eventually; the CSV comes first.
- **Revoking redeemed seats when a batch is voided.** Structurally impossible given no provenance,
  by design.
- **Attributing readers to a batch in the sales report.** Same reason.
- **Storing who redeemed, in any form.** Explicitly rejected by the operator; reversing it needs a
  superseding ADR, not a ticket.
- **Cross-Edition batches.** One batch sells exactly one Edition; a course in two languages needs
  two batches.

## Further Notes

- **Vouchers make a fourth Entitlement writer.** The other three are the PayFast ITN, a confirmed
  EFT Intent, and the Admin comp. `CONTEXT.md` was corrected on 2026-08-18 to say so; it had
  claimed the ITN was the only one since before the EFT rail shipped.
- **An unpaid batch has already granted its seats.** The Seller owns the commercial relationship,
  so this is their risk, and it follows directly from codes being live at creation. The platform's
  protection is only that the Seller is not *paid* until the cash is logged.
- **"My code says it is already used" is unanswerable**, permanently and by design. Support should
  be told this plainly rather than discovering it under pressure.
- **The grant walk in `convex/lib.ts` needs no change.** A voucher mints an ordinary Entitlement
  row, and the walk already treats an Entitlement's presence as access. That the walk is untouched
  is a sign the design sits on the existing grain rather than beside it.
