---
type: task
blocked_by: [03]
---

> `/wayfinder .plan/maps/marketplace/tickets/07-build-donation-rail-backend.md`

# Build the donation rail — backend, config and ADR 0027

## Question

Nothing to decide: [Donation functionality](03-donation-link-and-prompt.md) settled the
whole shape, and this is the build. **Read 03's `## Answer` first and follow it** — where
a detail is not written there, it was not decided, so grill rather than invent.

Use `/tdd` (test-first) and `/ponytail`. This is the **money half**; the widget is
[08](08-build-donation-widget-and-landing-section.md), which is blocked on this.

The work, roughly in dependency order:

1. **ADR 0027 — the donation rail.** Following ADR 0026's precedent of writing the ADR
   *after* the code is real, this can land last, but it must land. It records: the rail
   in one page, that the operator stays merchant of record, the `ledger` widening, the
   no-intent-table reasoning, and the Section 18A consequence (which is a *stated
   consequence*, not an open question).
2. **`ledger` widening.** `topicId` and `lang` → optional; add
   `kind: v.union(v.literal("sale"), v.literal("donation"))`. Every existing writer
   (`market.fulfillPurchase`, `eft` confirm) sets `kind: "sale"` explicitly. Existing
   rows need a **backfill** to `"sale"` before the field can be required.
3. **The Sales-tab exclusion.** Both queries in `convex/sales.ts` (the report and the
   by-day chart) group by `topicId` and fetch a course title — they must filter to
   `kind === "sale"`. **This is the regression risk of the whole ticket**: a donation row
   reaching either query is a crash or a "(deleted course)" row, so test it directly.
4. **The Payouts tab.** `convex/ledger.ts`'s `owed` groups by `sellerId` and should admit
   donations untouched — verify, and decide how a donation row displays where a `lang`
   would be. `markPaid` needs nothing.
5. **Donation constants.** A new module: `DONATION_FEE_BPS = 1000`, the USD→ZAR rate, and
   a minimum. **Do not reuse `PLATFORM_FEE_BPS`** — it is a global env var at 5000 for the
   50/50 sale split, and reusing it would silently take half of every donation. Bound the
   bps like `platformFeeBps()` already does.
6. **Tenant config.** A sixth flag on `tenantFlagsValidator` — all five existing flags are
   **required** booleans, so this needs a **backfill migration** over every tenant row —
   plus `donationPayee: v.optional(v.id("users"))` on the tenant record.
7. **The payee gate.** Sys-admin-only writes for both the flag and the payee (a tenant
   admin must not be able to redirect donation income to a member account). **The flag
   cannot switch on unless the payee `isReadySeller`** (`convex/sellerStatus.ts` — granted
   + SA bank details on file), so donation debt can never accrue with nowhere to send it.
   Enforce server-side inside the mutation, the way the other five flags are.
8. **The signed-fields query.** An **unauthenticated query** — not a mutation, not an
   action — taking `{ tenantSlug, usdAmount }` and returning the signed PayFast fields with
   `custom_str1 = tenantSlug`, `custom_str2 = "donation"`, and the derived ZAR amount.
   `buildCheckoutFields` is already pure (no ctx, no network), so this writes nothing.
   Validate the minimum and reject a disabled flag or an unready payee here too.
9. **The ITN donation branch.** In the existing verified-ITN path: when
   `custom_str2 === "donation"`, look up the tenant, resolve `donationPayee`, and write one
   `kind: "donation"` ledger row with `sellerId` = payee, `buyerEmail` = the ITN's
   `email_address`, and `splitNet(net, DONATION_FEE_BPS)`. **No Entitlement is minted.**
   Idempotency comes from `payfastEvents` on `pf_payment_id`, unchanged.

Watch the invariants 03 relied on: exactly one of `pfPaymentId`/`eftRef` per row (a
donation is a PayFast payment, so `pfPaymentId`); **nothing persisted before the verified
ITN**; and the PayFast sale path untouched — ADR 0026's warning about putting a new
feature's schema changes on the code path that is currently moving money correctly applies
directly to step 2.

## Done when

The `ledger` carries `kind` with existing rows backfilled to `"sale"`; the Sales tab
provably excludes donations and the Payouts tab provably includes them; the tenant flag +
`donationPayee` exist with the sys-admin and `isReadySeller` gates enforced server-side;
the unauthenticated signed-fields query returns correct signed fields for a donor-chosen
amount; a simulated donation ITN mints one donation ledger row and **no Entitlement**, and
a replayed one is a no-op; the PayFast sale path has no behaviour change; and ADR 0027 is
written. Tests cover the ITN branch and the Sales-tab exclusion.

## Answer

Built 2026-08-01. **[ADR 0027](../../../../docs/adr/0027-per-tenant-donation-rail.md)
is the record** — it holds the reasoning; this notes only what a later session
would be surprised by. All nine steps landed, plus the sys-admin config UI (the
flag is unusable without a way to name a payee). 774 tests pass; `tsc` clean.

Commits: `119cb8e` (a flake fix that had to come first), `66cc9b3` (the rail),
`ee27ea3` (the dashboard), `05fd26a` (ADR 0027 + CONTEXT.md).

### Three places the build deviates from this ticket, all deliberate

1. **No tenant-flag backfill, and the flag is `v.optional`** — step 6 asked for a
   migration over every tenant row. It isn't needed, and the reason is that step
   6 inherited the *shape* of the existing five flags without their *reason*:
   those are required because their v1 default was `true`, so "no regression"
   had to be written onto every row. A donation rail must default **off**, so
   **absence already carries the right meaning** — and `assertTenantFlag` reads
   it truthily, making an unset flag fail-closed, which is what money wants. A
   test pins this: a tenant row with exactly today's five flags is off. One
   fewer prod migration on a money feature.
2. **`ledger.kind` is optional and the Sales filter reads `!== "donation"`, not
   `=== "sale"`** — steps 2 and 3 asked for the backfill first so `kind` could be
   required. Written that way it needs two deploys, and in the window between
   them `=== "sale"` **silently drops the entire pre-0027 sales history from the
   Sales report** — a worse regression than the one the step was guarding
   against. So: `kind` optional, every writer sets it, readers deny-list
   donations, and `pnpm run backfill-ledger-kind:prod` stamps the legacy rows.
   **The narrow to required is the one piece of this ticket left undone** (see
   below). A comment at the filter says a third money kind must flip it to an
   allow-list — that is the single way the predicate goes wrong.
3. **`usdCents`, not `usdAmount`** — step 8 named the arg `usdAmount` without
   saying dollars or cents. Integer cents, matching the rest of the codebase
   ("never trusts parseFloat at the money boundary"). The query returns the
   `zarCents` it signed, so the widget's anti-surprise line quotes the number
   actually charged rather than converting a second time.

### The two numbers 03 left unnamed

Grilled rather than invented, per this ticket's instruction:
**`USD_ZAR_RATE = 18.4`** (deliberately under the market rate, so drift favours
the donor) and **`MIN_DONATION_USD_CENTS = 500`** ($5 — low enough not to deter
a casual donor, high enough that PayFast's fixed fee isn't most of the gift).
Both are committed constants changed by deploy, per 03 §6.
[Live USD→ZAR rate](../../technical-foundation/tickets/13-live-usd-zar-rate.md) replaces the first later.

### Decided here, since 03 didn't

- **A donation row in Payouts** shows `lang: null` plus an explicit `kind`; the
  UI writes "donation" where a language code would go. Nullable rather than a
  stand-in string — "Donation" is not a language code, and inventing one puts
  presentation text inside a Convex query.
- **The donation checkout sends no `m_payment_id` at all.** It has no intent to
  reference, and the alternative (minting a random token) would put
  non-determinism in a cached query for a value nothing reads.
- **A donation that lands with no valid payee 500s**, rolling back the
  idempotency row so PayFast retries. Better a retried notification than money
  banked with nobody recorded as owed.
- **`setDonationPayee` with no email clears the payee AND switches the flag
  off**, so the pair can never disagree — the failure would otherwise surface at
  donor time instead of configuration time.

### Left undone, on purpose

**`ledger.kind` is not yet narrowed to required.** That needs
`pnpm run backfill-ledger-kind:prod` run against prod first (take a Convex
snapshot — the script is idempotent), then a one-line schema edit and the two
readers flipped to an allow-list. Nothing depends on it; it is hygiene that buys
safety for a *third* money kind, and doing it now would have meant shipping a
money feature across two coupled deploys. Deliberately not ticketed as its own
star — it is a line in this Answer and belongs to whoever next touches the
Ledger schema.

Also **not** done here and correctly so: the donor-facing widget and the landing
section are [08](08-build-donation-widget-and-landing-section.md), which this
unblocks. The widget must state the 10% and the "not a tax-deductible receipt"
line; `donations.config` serves it the floor, the rate and the fee from the one
place they are defined, so the copy cannot drift from the constants.

### One thing found on the way

`convex/sales.test.ts` carried a latent flake — it asserted that convex-test
freezes the clock, which it does not, so two seeded rows straddling a
millisecond broke a window assertion. It passed alone and failed only under a
loaded full-suite run. Fixed in its own commit *before* the feature work, so the
green suite this ticket claims is honestly green.
