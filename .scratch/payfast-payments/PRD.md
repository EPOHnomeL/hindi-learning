# PRD: PayFast Payments — full replacement of the Stripe Connect rail

Status: done

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Seller**, **Entitlement**,
> **Preview**, **Edition**, **Ledger** (new), plus Topic, Guest, Viewer, Public link,
> Allowlist, Admin, Certificate. Direction: [ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)
> (the marketplace shape) — **this PRD supersedes its payment rail**: Stripe Connect is
> ripped out and replaced by PayFast (South Africa). Also respects ADR 0001 (no LLM in
> the web app), ADR 0011 (Allowlist / Admin portal), ADR 0013 (Public link), ADR 0015
> (account-bound Certificates).
>
> Supersedes the payment mechanics of [`../paid-marketplace/PRD.md`](../paid-marketplace/PRD.md).
> The **access model is unchanged** — an Entitlement is still the holder, the Edition
> access resolver and readers are untouched. Only the money path changes.

## Problem Statement

The marketplace spine was built on **Stripe Connect** (direct charges to each Seller's
own connected account + a 15% application fee). For a South-Africa-first launch that is
the wrong rail: Stripe Connect onboarding is heavy, and — decisively — the operator
wants a marketplace where **course authors never register their own payment account**;
they just give their bank details and get paid. Stripe's model can't express that
without per-Seller connected accounts. The rail must move to **PayFast**, the SA gateway
the operator actually uses, without disturbing how access is granted or read.

## Solution

Replace the payment rail with **PayFast, operator-as-sole-merchant-of-record**, and pay
authors out manually against an in-app **Ledger**:

- **The platform collects every sale into its one PayFast account.** Authors never touch
  PayFast; PayFast rail-level Split Payments is **not** used.
- **Revenue is split 50/50 on the NET** (sale minus PayFast's processing fee), computed
  directly from the ITN's `amount_net`. The platform take-rate is **50%**
  (`PLATFORM_FEE_BPS=5000`, configurable). Each sale writes a **Ledger** row recording
  gross / fee / net / the author's 50% (what the operator owes) / the platform's 50% /
  a payout status (`owed` → `paid`). The operator disburses by EFT out of band and marks
  the row paid.
- **A Seller is ready to sell when the Admin has granted `can-sell` AND the author has
  saved payout bank details in-app** — no external onboarding. Pricing is guarded on
  ready-Seller + a `completed` course, and is **ZAR-only**.
- **Buying is guest-first.** A learner reads the free **Preview**, clicks Buy, enters an
  email, and is redirected (signed form POST) to PayFast's hosted checkout. Access is
  granted **only** by the verified **ITN** (server-to-server notification), never the
  client redirect. The ITN mints an **Entitlement** (account exists) or an email-keyed
  **pending Entitlement** (guest) which is claimed on sign-up; a pending purchase admits
  the email past the **Allowlist**. On return, the sign-up email is **prefilled and
  locked** to the paid email so access can't be stranded on a mismatched account.
- **No refunds.** Nothing automated listens for refunds/chargebacks; the manual Admin
  `revokeEntitlement` tool is the only safety valve.

## User Stories

1. As an **Admin**, I want to grant a User the `can-sell` capability, so that a trusted author can sell.
2. As an **Admin**, I want to revoke `can-sell`, so that I can stop new listings without disturbing courses already sold.
3. As a granted author, I want to enter my South African bank details (account holder, bank, account number, branch code) in-app, so that the operator has somewhere to pay me — without registering any payment account of my own.
4. As an author, I want to see my Seller status (not granted / granted but no bank details / ready), so that I know whether I can price a course yet.
5. As a **Seller**, I want to be blocked from pricing until my bank details are on file, so that a course is never sold with nowhere to send my cut.
6. As a **Seller**, I want to price a finished course's Edition **in Rand (ZAR)**, so that learners can buy it in the currency the platform settles in.
7. As a **Seller**, I want to be blocked from pricing an unfinished course, so that a buyer is never stranded mid-course.
8. As a **Seller**, I want to change or clear a price, so that I can adjust it or make the Edition free again.
9. As the operator, I want every sale to land in my single PayFast account, so that I remain merchant of record and authors need no PayFast account.
10. As the operator, I want each sale split 50/50 on the amount **after PayFast's fee**, so that the processing cost is shared and my margin never goes negative on a cheap course.
11. As the operator, I want each sale to write a Ledger row recording what I owe the author, so that manual payouts are tracked, not guessed.
12. As the operator, I want to see the total I owe each author and mark a payout as paid with a reference, so that I can reconcile manual EFTs.
13. As a **Guest**, I want to read the first Lesson (the **Preview**) of a paid Edition free, so that I can judge quality before buying.
14. As a **Guest**, I want locked Lessons shown as "buy to read" rather than missing, so that I understand I need to purchase.
15. As a **Guest**, I want to buy lifetime access without a prior account, so that purchasing is quick.
16. As a buyer, I want to be sent to PayFast's hosted checkout to pay by card or Instant EFT, so that I use a payment method I trust.
17. As a buyer, I want access granted only after PayFast confirms my payment server-to-server, so that access is never spoofable from a redirect.
18. As a buyer without an account, I want an account created for the email I paid with, prefilled and locked, so that my purchase attaches to the right account.
19. As a buyer whose email had a purchase before sign-up, I want that purchase to activate the moment I create my account, so that timing never loses access.
20. As a buyer, I want buying to admit me past the **Allowlist**, so that I can purchase without being hand-invited.
21. As a buyer, I want every Lesson past the Preview plus its References unlocked forever after paying, so that I get what I paid for.
22. As a buyer, I want my access on any device I sign into, so that I am not tied to the device I bought on.
23. As a buyer, I want an Entitlement scoped to the Edition I bought, so that buying the Spanish Edition unlocks Spanish, not Urdu.
24. As a buyer who finishes a paid Edition, I want to earn a **Certificate** recording the language I completed, like any Viewer.
25. As the operator, I want a buyer's account to carry **no** selling/authoring privilege, so that buying can never escalate to selling.
26. As the operator, I want ITN events handled idempotently on `pf_payment_id`, so that a re-delivered notification never double-grants or double-writes the Ledger.
27. As the operator, I want a tampered amount or a forged/failed-validation ITN rejected, so that only genuine, correctly-priced payments grant access.
28. As an owner of an existing **free** course, I want it and its Public link to behave exactly as today, so that the rail change never regresses free sharing.

## Implementation Decisions

- **Access is unchanged from ADR 0016.** The Edition access resolver
  (`owner | viewer | entitled | preview | none`) and the reader queries are untouched; an
  **Entitlement** is still the sole new holder. Only its payment provenance changes.
- **Operator is sole merchant of record; no rail-level splits.** All sales are processed
  on the platform's PayFast credentials. PayFast Split Payments is not used, which makes
  its unverified split behaviours (who bears the split fee, sandbox split support, refund
  ITNs) irrelevant — a plain single-account payment is fully documented and sandbox-testable.
- **50/50 on net, from the ITN.** The ITN payload carries `amount_gross`, `amount_fee`,
  `amount_net`; the **platform's** share is `round(amount_net × PLATFORM_FEE_BPS / 10000)`
  with `PLATFORM_FEE_BPS` defaulting to **5000** (bounded [0,10000]). The remainder is the
  Seller's. Stored in a **Ledger** row per sale. *(Implementation correction: this formula
  originally handed the bps to the seller, contradicting the var's name and the platform's
  prior take-rate convention (1500 = 15% platform cut). At the decided 5000 both readings
  are identical; the code follows the name — the bps is the platform's cut.)*
- **Selling is a capability = Admin grant + payout bank details.** The `sellers` relation
  holds the `can-sell` grant plus the author's SA bank details. `sellerStatusOf` →
  `not-granted | granted-no-payout-details | ready`; `ready` requires both. Stripe's
  connected-account id and `chargesEnabled`/`payoutsEnabled` are removed.
- **Pricing is per Edition, ZAR-only.** A `listings` row prices a `(Topic, language)`
  Edition; presence ⇒ paid. `setEditionPrice` rejects any currency but `zar`; amount is
  stored in cents and rendered to 2-decimal Rand only when building the PayFast form.
  Guarded on ready-Seller **and** a `completed` course.
- **Checkout is a signed form POST.** `startCheckout` (available to Guests) takes the
  buyer's email and returns the signed PayFast field set for the client to POST to the
  hosted process URL (sandbox/live by `PAYFAST_MODE`). Fields: platform `merchant_id`/
  `merchant_key`, `amount` (Rand), `item_name`, `email_address`, `return_url`/
  `cancel_url`/`notify_url`, `m_payment_id` (our reference), and `custom_str*` carrying
  `topicId`/`lang`. The signature is MD5 of the fields + passphrase (PayFast's scheme),
  computed in a pure helper. *(Implementation correction: PayFast signs over the fields
  **in order** — its documented attribute order for the outgoing form, the received order
  for an ITN — never alphabetically. An alphabetical canonicalisation would be rejected by
  the gateway; `payfast.ts` therefore preserves field order, and `startCheckout` returns
  the fields as an ordered pair-list because Convex sorts object keys.)* A **checkout-intent** record
  (`m_payment_id` → email/topicId/lang) is persisted so the return page can prefill+lock
  the sign-up email without racing the ITN.
- **Access is granted only by the verified ITN.** `POST /payfast/notify` (HTTP action)
  verifies in three steps — **inline-MD5 signature**, **amount match** against the stored
  listing, and a **server postback** to PayFast's `/eng/query/validate` requiring `VALID`
  — then calls the idempotent `fulfillPurchase`. The source-IP allowlist check is
  deliberately skipped (serverless IP unreliability; the postback subsumes it). Idempotency
  is keyed on `pf_payment_id` in the `payfastEvents` ledger.
- **Fulfilment writes the Ledger in the same transaction.** `fulfillPurchase` mints the
  Entitlement (or pending Entitlement, keyed on the paid email, carrying `pf_payment_id`)
  **and** writes the Ledger row from the ITN's `amount_net`, so "money in + what we owe"
  is one seam. Guest admission (pending Entitlement admits the email past the Allowlist)
  is unchanged.
- **No automated refund path.** The Stripe `charge.refunded` / `charge.dispute.closed`
  handling and `revokePurchaseByPaymentIntent` are removed; manual Admin
  `revokeEntitlement` remains.
- **Clean Stripe rip-out.** `stripe.ts` and the `stripe` npm dependency are deleted; the
  Stripe env vars are dropped; `stripeEvents`→`payfastEvents`, the `sellers` Stripe fields
  → bank details, `stripePaymentIntentId` dropped from entitlements/pendingEntitlements.
  Because all marketplace tables are empty on dev, no data migration is required.
- **Inline MD5.** Convex's runtime Web-Crypto has no MD5; a small pure-JS MD5 lives in
  `payfast.ts` for both signing outgoing fields and verifying ITN signatures.
- **New env vars:** `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`,
  `PAYFAST_MODE` (`sandbox`|`live`), plus existing `SITE_URL`, `PLATFORM_FEE_BPS`.

## Testing Decisions

**What makes a good test here:** assert external behaviour at a seam — the access a caller
gets, the effect of a verified/forged notification, the Ledger row a sale produces — never
implementation detail or UI. PayFast's one network call (the postback validate) is mocked
at the action boundary; the signature/field builders are pure and tested with vectors.

- **Seam — PayFast primitives (new, pure).** Signature construction/verification against a
  known field/passphrase vector; the net-split math (`amount_net` → author/platform shares)
  including the fixed-fee-heavy low-price edge; ZAR Rand formatting from cents.
- **Seam — access resolver (reused, unchanged).** The existing Edition truth-table read
  tests stand; only fixture currency becomes `zar`. An Entitlement for `es` does not unlock
  `ur`; a paid Edition shows only the Preview to an unentitled caller; a free Edition is
  unchanged. Prior art: the existing `content`/`public` read tests.
- **Seam — purchase fulfilment (reused shape).** `fulfillPurchase` tested directly (no
  network): mints once and is idempotent on `pf_payment_id`; account-exists → Entitlement,
  no-account → pending → claimed on sign-up; the Ledger row records the correct
  gross/fee/net/author-50%/platform-50%/`owed`. Prior art: the existing purchase-lifecycle
  tests and the pending-Share claim-on-sign-up tests.
- **Seam — ITN HTTP boundary (replaces the webhook).** A missing/forged signature → 400,
  nothing written (no `payfastEvents` row, no Ledger row); a postback that returns not-`VALID`
  → rejected (mock the validate `fetch`); an amount that doesn't match the listing → rejected;
  a genuine ITN → grants + writes the Ledger. Prior art: the existing bad-signature webhook test.
- **Seam — seller gating (reused guard, redefined readiness).** A non-Seller can't price; a
  granted Seller with no bank details can't price; a non-ZAR currency is rejected; a
  seeded/unfinished course can't be priced; grant/revoke and the bank-details read are
  Admin-scoped; bank details are never returned by a non-admin query. Prior art: the existing
  seller-gating and Allowlist admission tests.
- **Seam — ledger admin (new, small).** Owed totals per author sum only `owed` rows;
  mark-paid flips `owed`→`paid` and records a reference; both are Admin-only.
- **The entitled-≡-Viewer invariant.** A buyer gains a Viewer's read access, own Progress,
  and Certificate eligibility, but cannot record Responses or ask Questions.

## Out of Scope

- **Rail-level PayFast Split Payments** and per-author PayFast merchant accounts — a later
  phase, gated by real third-party-author volume.
- **Automated disbursement** to authors' bank accounts (a payout API) — Phase 1 is manual EFT.
- **Automated refund / chargeback handling** — no refunds; manual Admin revoke only.
- **Buyer-side multi-currency display** (PayFast Multi-Currency Pricing) — ZAR-only for now.
- **Subscriptions, per-lesson sales, coupons, bundles, reviews/ratings, discovery catalogue.**
- **Naming the buyer role**, and per-buyer Responses/Questions — buyer keeps Viewer semantics.
- **The aggregator / SARS-VAT posture** of operator-as-merchant-of-record — flagged as a
  business/legal follow-up, not built here.

## Further Notes

- **Why this is leaner than the Stripe build:** dropping rail-level splits removes connected
  accounts, Express onboarding, the `account.updated` webhook, and the application-fee plumbing
  — replaced by a bank-details field, a Ledger, and a manual payout screen.
- **Regulatory flag (not blocking):** collecting others' sales into one account and paying
  authors out makes the operator a payment aggregator / merchant-of-record for third parties,
  with SARS/VAT implications. A non-issue while the operator is effectively the only Seller;
  revisit as real third-party authors arrive.
- **Sandbox:** PayFast's sandbox (`sandbox.payfast.co.za`, test merchant `10000100`) supports
  the plain single-account flow this PRD uses, so the whole money path is provable on the dev
  Convex deployment without registering anything.
- **Build order:** prefactor (schema + pure module + rip-out) → seller readiness/pricing →
  checkout initiation → ITN grant + ledger → post-payment signup/claim → ledger admin.
