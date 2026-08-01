# A per-tenant donation rail on the shared Ledger

> Deliverable of the [marketplace](../../.plan/maps/marketplace/map.md) map —
> grilled and decided in [Donation functionality](../../.plan/maps/marketplace/tickets/03-donation-link-and-prompt.md)
> (2026-08-01), written after the rail was real, following ADR 0026's precedent.

## Status

Accepted 2026-08-01. **Adds to** [ADR 0026](0026-manual-eft-payment-rail.md) (the
operator as sole merchant of record) and [ADR 0016](0016-paid-course-marketplace-stripe-connect-facilitator.md)
(the paid marketplace). Supersedes nothing; reopens nothing.

## Context

The ask was "link where to donate to the site". A link is a hyperlink and would
have been an afternoon. It died on one derivation: **the operator cannot take a
cut of money it never sees.** An external donate button sends the donor to
someone else's payment page, and the platform's 10% has nowhere to come from. The
moment a cut is wanted, the money must ride our own rail — so this is a payment
integration, with a payout story, a currency problem and a tax consequence.

Everything the rail needs already exists: a live PayFast account, a verified-ITN
path that is the sole grantor of anything, a `ledger` table, a Payouts tab with an
`owed → paid` flip, and per-tenant feature flags. The design question was
therefore not "how do we take donations" but "how little new machinery can we
add" — and the answer turned out to be *less than expected*, because the two
things that make a sale complicated (an account to attach access to, and a price
to protect) are both absent from a donation.

## Decision

**A per-tenant, one-off, card-only donation rail: a flag-gated `#donations`
section on the tenant landing page. The donor types dollars, the platform charges
Rand, the platform keeps 10% of net, and the rest is owed to a sys-admin-nominated
payee user through the existing Ledger and Payouts tab.**

### The operator stays sole merchant of record

The donation lands in the same PayFast account every sale lands in. ADR 0026 is
not reopened. "Goes to the tenant" therefore means **owed to a payee user**,
settled through the machinery that already settles sales — because `operatorBank`
is global and singular by decision and `sellers.payout` is per-*user*. There is no
tenant bank account, and we did not invent one: the payee's existing `sellers` row
carries the details the operator EFTs to.

### 10% is its own constant, not the platform fee

`splitNet(net, DONATION_FEE_BPS)` at 1000 bps. "After PayFast fees" is *literally*
what the ITN's `amount_net` already means, so the existing split math serves
donations unchanged at a different rate. **`DONATION_FEE_BPS` is deliberately not
`PLATFORM_FEE_BPS`**: that is a global env var set to 5000 for the 50/50 sale
split, and reusing it would silently take half of every donation. It is a
committed constant rather than an env var because the take-rate is stated in the
widget copy — it must not drift per deployment.

### USD presented, ZAR charged, at a committed constant

The donor types dollars; the charge is Rand at `USD_ZAR_RATE`, with an explicit
anti-surprise line before they commit. This is the *worst* form of the presentment
problem — a fixed price shows one agreed number, but a donor-typed amount leaves
two live numbers — so the disclosure is load-bearing, not polish. The signed-fields
query returns the very ZAR figure it signed, so the quoted number and the charged
number cannot disagree.

**PayFast Multi-Currency Pricing cannot do this, and the reason is direction, not
eligibility**: the price is set in ZAR, the *buyer* picks a display currency, and
PayFast converts *out of* Rand. You cannot give it a USD base. MCP stays off for
donations — enabling it would put PayFast's dollar figure next to ours on the same
transaction, which is worse than either alone.

The rate is a committed constant changed by deploy, consistent with the surface it
serves (a landing page is hand-authored, "no DB, nothing runtime-editable"). The
accepted cost is staleness; the follow-up is
[Live USD→ZAR rate](../../.plan/maps/marketplace/tickets/05-live-usd-zar-rate.md).
A minimum donation exists because PayFast's per-transaction fee makes a $1
donation mostly fee — the floor protects the payee's 90%.

### No intent table, and therefore no public mutation

**This is the largest simplification in the design.** The other two rails persist
an intent row (`checkoutIntents`, `eftIntents`) whose entire job is to freeze *the
price the buyer was shown*, so a re-price between click and payment cannot strand
a genuine payment. **A donation has no price.** The donor invents the number and
we sign what they chose, so there is nothing to freeze and nothing to verify a
payment against.

What remains is one **unauthenticated query** returning signed PayFast fields.
`buildCheckoutFields` is pure — no ctx, no network — so this is a read.
Three consequences worth stating:

- **Nothing is persisted before the verified ITN**, so an anonymous caller has no
  junk-row abuse surface to create.
- **[ADR 0013](0013-public-link-shares.md)'s structural "there are no public
  mutations" guarantee survives intact.**
- The rail rides entirely on the signed custom fields: `custom_str1 = tenantSlug`,
  `custom_str2 = "donation"`. They are inside the signature, so a payment cannot
  be re-labelled or re-pointed at another tenant in flight. Idempotency is the
  existing `payfastEvents` table on `pf_payment_id`, unchanged.

### The donor is a Guest, with no email field

Preset chips and a Donate button — no account, and no email input either. PayFast
collects the email on its own page and the ITN hands it back; that value fills the
ledger row's `buyerEmail`.

**[ADR 0021](0021-open-signup-allowlist-gates-course-creation.md)'s auth-first
rule is not violated, because it has no subject here.** That rule exists so an
Entitlement can attach to an account and the purchase email can never be a typed
argument. **A donation grants nothing** — no Entitlement, no access, no account to
attach to. Requiring sign-up from a stranger on a marketing page before they may
give you money would cost donations for no gain. PayFast's own confirmation is the
donor's receipt; we send no email.

### One shared Ledger, with an explicit `kind`

A donation is a row in the same `ledger` table, with `topicId`/`lang` widened to
optional and an explicit `kind: "sale" | "donation"`. This is **the same move ADR
0026 already made** when it widened `pfPaymentId` to admit a second money source.

`kind` is explicit rather than inferred from an absent `topicId`, because "absent
means donation" is an inference every future reader must rediscover, and it
forecloses a third money source.

**The blast radius is inverted between the two options, and that is why the shared
table won.** The Payouts rollup groups by `sellerId`, so donations appear there for
free — that reuse is the whole point. The two Sales-tab queries group by `topicId`
and fetch a course title, so they get one explicit exclusion. A separate
`donations` table would have inverted this: Sales free, but Payouts and `markPaid`
forced to span two tables.

**Donations are excluded from the Sales report.** It reports revenue per course per
edition; a donation has no course, and folding it in corrupts the per-course
numbers. Donations surface in Payouts and nowhere else.

### Per-tenant configuration, gated by the operator

A sixth tenant flag plus `donationPayee: v.optional(v.id("users"))` on the tenant
row. Both are **sys-admin-only to write**, following ADR 0026's reasoning that a
money destination is not a subdomain administrator's call — letting a tenant admin
set the payee would open a self-dealing surface, redirecting the tenant's donation
income to any member account.

**The flag cannot be switched on unless the payee `isReadySeller`** (can-sell grant
+ SA bank details on file). This makes it structurally impossible to accrue
donation debt with nowhere to send it — the same gate that stops an Edition being
priced by an unready Seller. Readiness is re-checked at the moment of the ask and
again at the ITN, never cached into the flag: a payee whose details are revoked
after the flag went on must not keep collecting.

## Consequences

- **A donor cannot obtain a Section 18A tax-deductible receipt from the tenant.**
  The operator receives the money; the tenant never does. A PBO cannot issue a
  receipt for money it did not receive, and the received-then-passed-on amount may
  read as operator revenue rather than a conduit. This is **structural, not a copy
  problem**: the only fix is reversing merchant-of-record for donations, which
  reverses ADR 0026 and is its own effort. The widget's "this is not a
  tax-deductible receipt" line is a mitigation, not a solution. **Worth an
  accountant's five minutes before go-live** — this ADR is not legal advice.
- **The exchange rate goes stale unless someone watches it.** Accepted knowingly;
  the constant is under-set rather than over-set so the drift favours the donor.
- **`ledger.kind` is optional in the schema, not required.** Rows written before
  this ADR carry none, and they are all sales. Readers therefore test *"not a
  donation"* rather than *"is a sale"* — testing `=== "sale"` would silently drop
  the entire pre-0027 history from the Sales report. `pnpm run
  backfill-ledger-kind:prod` stamps the legacy rows, after which `kind` can be
  narrowed to required. **A third money kind must flip those readers to an
  allow-list** — that is the one way the current predicate goes wrong.
- **The `donations` flag is the only optional tenant flag**, and that is
  deliberate. The other five are required because their v1 default was `true` (no
  regression from always-on behaviour), which had to be written onto every row. A
  donation rail must default *off* — a new money destination is an opt-in operator
  act — so absence already carries the right meaning, needs no backfill migration,
  and is fail-closed, which is what money wants.
- **A donation that arrives with no valid payee is not banked silently.** The
  fulfilment mutation throws, which rolls back the idempotency row and returns 500,
  so PayFast retries and the operator sees it. Better a retried notification than
  money in the account with nobody recorded as owed.
- **Recurring giving is ruled out of this rail**, and it collides with the Guest
  decision: an anonymous donor has no account to cancel a subscription from. Also
  ruled out: **EFT donations** (the manual reference exists to reconcile a *known*
  price against a bank statement, and a donor-chosen amount is much harder to match
  by hand) and **a donation popup on Public links** (it interrupts a Guest
  mid-lesson, and it is the one place ADR 0013's queries-only Guest seam would need
  reasoning about again).
- **The donation take-rate is now stated in two places** — the constant and the
  widget copy. They must be changed together.
