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
