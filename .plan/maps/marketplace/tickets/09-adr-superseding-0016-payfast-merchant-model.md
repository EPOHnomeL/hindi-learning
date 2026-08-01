---
type: grilling
blocked_by: []
---

# Supersede ADR 0016 — the money model that actually shipped

> `/wayfinder .plan/maps/marketplace/tickets/09-adr-superseding-0016-payfast-merchant-model.md`

## Question

**The repo's decision record for how money works says the opposite of what runs.**

[ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)
is titled *"Sellers sell, platform facilitates via **Stripe Connect** (**not** merchant
of record)"* and is still `status: proposed`. The shipped reality is the exact inverse
on both counts:

| ADR 0016 says | What runs |
|---|---|
| Stripe Connect | **PayFast** — Stripe appears nowhere in `convex/` or `src/` except two mentions inside `convex/payfast.ts` / `payfast.test.ts` |
| Seller is merchant of record; platform facilitates | **Operator is sole merchant of record** — all sales collect into one PayFast account, authors never register their own |
| 15% platform fee | **50%**, split on the *net* — `PLATFORM_FEE_BPS=5000` |

The pivot (2026-07-08/07-10, Stripe ripped out rather than run alongside) has **no
decision record at all** — its only written trace is `.scratch/payfast-payments/PRD.md`,
a scratch file. So 0016 stands as the current record by default, and later ADRs now
build on it: [0026](../../../docs/adr/0026-manual-eft-payment-rail.md) says it "**adds
to** ADR 0016… supersedes nothing", and
[0027](../../../docs/adr/0027-per-tenant-donation-rail.md) cites it too. Both are
extending a record whose spine is wrong.

This is not academic. The rail is **live and holding real money**, the donation tickets
on this map touch the same rails, and this map's own Notes quoted 0016's seller-as-merchant
model as fact until 2026-08-01.

**Write a new ADR superseding 0016** — do not rewrite it. That is the repo's rule
(`CLAUDE.md`, "Verify the claim before you reason from it") and its established practice:
[0025](../../../docs/adr/0025-per-tenant-session-isolation.md) supersedes 0022 §4a rather
than editing it, so the original stands as the record of what was decided and when.

What the new ADR has to settle, and why it is a grilling and not a transcription:

1. **Scope of supersession** — 0016 decides several things at once (Edition-grain sale,
   free first-Lesson Preview, lifetime Entitlement, no refunds, *and* the rail + merchant
   model). Only the **rail and merchant model** were inverted; the rest still holds and is
   consumed across this map. The new ADR must supersede the parts that flipped and say
   explicitly which parts of 0016 survive, or it will read as invalidating the paygate
   spine as well.
2. **Whether 0016's `status` changes** — it is `proposed`, not `accepted`, which is its own
   oddity for a decision that shaped a shipped system. Decide whether the superseding ADR
   marks it `superseded` (a status edit, arguably not a rewrite) or leaves it untouched with
   the new ADR carrying the whole correction.
3. **The consequences 0016 reasoned about that no longer apply** — seller onboarding to a
   payment provider, per-seller payout rails, platform-as-facilitator liability. The manual
   `ledger` payout model replaced them; say so, so nobody rebuilds toward Connect.
4. **Renumbering 0026 and 0027's cross-references** — both point at 0016 as their base.
   Decide whether they get a one-line pointer to the new ADR or are left alone.

Grill the operator on 1 and 2 before writing; the rest follows from
`docs/agents/project-context.md` §Payments and ADR 0026.

## Done when

A new ADR exists in `docs/adr/` recording the PayFast + operator-as-sole-merchant-of-record
model as the decision that actually shipped, naming its supersession scope over ADR 0016
explicitly, with an absolute date. ADR 0016 itself is not rewritten. `CONTEXT.md` and this
map's Notes agree with it.

<!-- Filed 2026-08-01 from ywampotch-launch 08. The mismatch was found by the 2026-07-29
     docs-reconciliation sweep (.scratch/docs-reconciliation/FINDINGS.md §4), which reported
     it and correctly declined to act; it then sat unticketed because that sweep's output
     was a scratch report rather than a map. -->
