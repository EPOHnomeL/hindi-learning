---
type: grilling
blocked_by: []
---
# The translator revenue share: a third split, and who may set it

## Question

A Translator is going to earn a percentage of that language's sales, configurable per
tenant (YWAM Potch, 10% was the example). That is the reason `translators` is keyed
**(tenant, language)** and unique, rather than being a loose roster. This ticket settles
the money model. It does not build it (11 does).

Today the split is **two-way and global**: `splitNet(net, bps)` returns
`{ sellerShare, platformShare }` from a single `PLATFORM_FEE_BPS` env var defaulting to
5000 ([`convex/payfast.ts:255`](../../../convex/payfast.ts)), and `ledger` carries
exactly two share columns and one `sellerId`. A translator cut makes it **three-way**,
with the rate **per tenant** rather than per deployment.

What needs deciding:

- **Where the rate lives.** Recommended: on `tenants`, as basis points, optional, absent
  reading as zero so every tenant keeps today's behaviour with no migration. The
  precedent for a tenant-level money field is `donationPayee`.
- **How the three-way split is computed**, and out of what. Translator share out of
  `net`, or out of the seller's share? Rounding, and who absorbs the remainder cent, so
  the three parts always sum exactly to `net`.
- **How `ledger` records it.** A third share column plus a payee id, or a small
  per-payee breakdown. Whichever, the `owedPayouts` rollup and `markPaid` have to handle
  a second kind of payee, and `ledger.owedPayouts` is currently the only query there.
- **The freeze.** Recommended and near-certain: the rate **and** the payee are frozen
  onto each `ledger` row at sale time, exactly as `checkoutIntents.amount` freezes the
  shown price and regional pricing freezes the derived ZAR. Otherwise appointing a
  translator in September silently creates a debt against every August sale, and moving
  a tenant from 10% to 15% rewrites history.
- **A translator who cannot be paid.** Being rostered needs a name. Being paid needs an
  account, a grant, and `sellers.payout` bank details, which today are gated behind the
  Admin's can-sell grant on the `sellers` table. Zondi has no email at all. So what
  happens to a share accrued to an unpayable payee: does it accrue and wait, or not
  accrue?
- **What happens on reassignment.** The frozen rows answer history, but the roster is
  updated in place, so the report's "projected" figure changes the moment a translator
  changes. Say whether that is fine.

**The self-dealing question is already decided and is not reopened here.** The owner
selects the translator and the **tenant sets its own rate**. That goes against
`donationPayee`, whose schema comment says a money destination is "not a subdomain
administrator's call, and letting one set it would open self-dealing", and it was chosen
with that read aloud. Write the **ADR** recording it as accepted risk. It supersedes
nothing: the `donationPayee` rule stands for donations, and this records that the
translator rate deliberately went the other way. Per CLAUDE.md, do not rewrite the
existing ADR or the schema comment to match.

## Done when

- Every bullet above has an answer in the Answer section, sharp enough for 11 to build
  from without re-deciding.
- An ADR in `docs/adr/` records the tenant-settable rate as accepted risk, naming the
  `donationPayee` precedent it departs from.
- The Answer opens with **"decided, NOT built"**, so the resolved status does not read
  as shipped.
