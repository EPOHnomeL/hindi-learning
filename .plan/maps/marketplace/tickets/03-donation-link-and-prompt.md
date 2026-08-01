---
type: grilling
blocked_by: []
---

# Donation functionality

## Question

Want to link where to donate to the site if users want to. Maybe make it a popup on public links for sites.

## Done when

A decision on where a donation goes (external link vs an in-app rail), which surfaces prompt for it, and whether any payment plumbing is involved — written down, then ticketed or ruled out.

<!-- Migrated 2026-07-30 from GitHub issue #45 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `donations` map (2026-08-01)

<!-- was .plan/maps/marketplace/tickets/03-donation-link-and-prompt.md; that single-ticket map was consolidated into marketplace -->

- The ask, verbatim: *"Want to link where to donate to the site if users want to. Maybe make
  it a popup on public links for sites."* Two separable ideas in one sentence — the
  destination (where money goes) and the prompt (where it's asked for).
- **Ponytail posture strongly applies.** An external donation link is a hyperlink. An in-app
  donation rail is a payment integration with a payout story, tax questions, and a refund
  policy. Establish which one is actually wanted *first* — this is the whole grilling.
- Payment rails already exist here (PayFast checkout, and the manual EFT rail from the
  ywampotch launch). If a real rail is wanted, reuse, don't invent.
- A donation prompt on a Public link is aimed at a **Guest** — an anonymous, unauthenticated
  reader. That constrains anything involving an account.
- Per-tenant question: does a YWAM Potch public link solicit donations for YWAM Potch or for
  the platform? This decides whether it is one feature or a tenant-configured one.
- Skills: `/grilling`, `/ponytail`.
- **Out of scope:** paid course sales — that is the marketplace paygate
  ([Authoring-cost funding & model-provider strategy](01-authoring-cost-and-model-provider-strategy.md)
  and ADR 0016), a different transaction with a different legal shape.

---

## Answer

Grilled and decided 2026-08-01. **It is an in-app rail, not a link** — and the
reason is the operator's cut: *you cannot take 10% of money you never see*. That
single derivation collapsed the external-link branch the ticket opened with, and
everything below follows from it.

**A per-tenant, one-off, card-only donation rail, rendered as a flag-gated
`<section id="donations">` on the tenant landing page** — reachable at
`<tenant>.my-course.app#donations`. The donor types **dollars**; the platform
charges **Rand**; the platform keeps **10% of net** and owes the rest to a
nominated payee user.

### The money

1. **The operator stays sole merchant of record.** The donation lands in the same
   PayFast account every sale lands in. ADR 0026 is not reopened.
2. **"Goes to the tenant" means *owed* to a payee user**, settled through the
   existing `ledger` + Payouts tab and the existing `owed → paid` flip with a
   reference. There is no tenant bank account and we did not invent one:
   `operatorBank` is global and singular by decision, and `sellers.payout` is
   per-*user*. The payee's bank details are the ones already on their `sellers`
   row.
3. **The 10% is `splitNet(net, 1000)`.** "After PayFast fees" is *literally* what
   the ITN's `amount_net` already means, so the existing split math in
   `convex/payfast.ts` serves donations unchanged at a different bps. **It must be
   a new constant, NOT `PLATFORM_FEE_BPS`** — that is global, set to 5000 for the
   50/50 sale split, and reusing it would silently take half of every donation.

### Currency — USD presented, ZAR charged

4. **The donor types USD; the charge is ZAR at an operator-set rate**, with an
   explicit anti-surprise line ("you will be charged **R920.00 (ZAR)**; your bank
   sets the exchange rate") shown before they commit. This is the *worst* form of
   the presentment problem — with a fixed price you show one agreed number, but a
   donor-typed amount leaves two live numbers — so the disclosure is not optional
   polish.
5. **PayFast Multi-Currency Pricing cannot do this, and the reason is direction,
   not eligibility.** Confirmed against
   <https://payfast.io/features/multi-currency-pricing/> and their
   [setup KB](https://support.payfast.co.za/portal/en/kb/articles/how-do-i-set-up-multi-currency-pricing):
   the price is set in **ZAR**, the *buyer* picks a display currency from a
   dropdown, PayFast shows a real-time conversion **out of** ZAR, the buyer
   accepts, and the merchant still settles ZAR. Visa/Mastercard only (no AMEX);
   it sits on PayFast's Aggregation solution. **You cannot give it a USD base and
   have it derive Rand.** MCP therefore stays **off** for donations — enabling it
   would put PayFast's own dollar figure ($51.40) next to ours ($50) on the same
   transaction, which is worse than either alone.
   *(This partly answers the support query
   [ywampotch-launch/11](../../ywampotch-launch/tickets/11-regional-pricing-mechanism.md)
   was told to open with — see the note left on that ticket. It is NOT resolved
   here.)*
6. **The rate is a committed constant, changed by deploy.** Consistent with the
   surface it serves: `src/app/_landing/registry.ts` states that a landing page is
   "hand-authored as a React component and registered here… no DB, nothing
   runtime-editable". A rate constant obeys the same rule. Accepted cost: it goes
   stale if nobody watches it — hence the follow-up ticket
   [Live USD→ZAR rate](05-live-usd-zar-rate.md).

### The donor is a Guest

7. **No account, and no email field either.** The widget is preset chips
   ($10 / $25 / $50 / custom) plus a Donate button. **PayFast collects the email on
   its own page and the ITN hands it back** — confirmed present in the ITN payload
   (`convex/purchase.test.ts`, alongside `amount_net`) — and that value fills the
   ledger row's `buyerEmail`.
8. **ADR 0021's auth-first rule does not apply and is not violated.** That rule
   exists so an Entitlement can attach to an account and the purchase email can
   never be a typed argument. **A donation grants nothing** — no Entitlement, no
   access, no account to attach to — so the rule has no subject here. Requiring
   sign-up from a stranger on a marketing page before they may give you money
   would cost donations for no gain.
9. **No thank-you email from us.** PayFast's own payment confirmation is the
   donor's receipt. The widget copy states plainly that **this is not a
   tax-deductible receipt**.

### No intent table, and therefore no public mutation

10. **A donation rides entirely on the PayFast custom fields.** `custom_str1` =
    tenantSlug, `custom_str2` = `"donation"`; the ITN reads them, looks up that
    tenant's `donationPayee`, and writes the ledger row. Idempotency is already
    handled by `payfastEvents` keyed on `pf_payment_id`.
11. **Why no intent row, when both other rails have one:** `checkoutIntents` and
    `eftIntents` exist to freeze *the price the buyer was shown*, so a re-price
    between click and payment cannot strand a genuine payment. **A donation has no
    price** — the donor invents the number and we sign what they chose — so there
    is nothing to verify against and nothing to freeze.
12. **The only server call is an unauthenticated *query* returning the signed
    checkout fields.** `buildCheckoutFields` is already pure (no ctx, no network —
    see the header comment in `convex/payfast.ts`), so this is a read. **Nothing is
    persisted until the verified ITN.** Two consequences worth stating: there is no
    junk-row abuse surface for an anonymous caller to create, and **ADR 0013's
    structural "there are no public mutations" guarantee survives intact.** This
    was the largest simplification of the grilling.

### Recording

13. **A row in the shared `ledger`, with an explicit `kind: "sale" | "donation"`.**
    `topicId` and `lang` widen to optional; `sellerId` holds the payee user;
    gross/fee/net/split come from the ITN. This is **the same move ADR 0026 already
    made** when it widened `ledger.pfPaymentId` to optional to admit a second money
    source — a shared ledger, with the rail-specific tables kept separate.
14. **`kind` is explicit, not inferred from an absent `topicId`.** "Absent means
    donation" is an inference every future reader must rediscover, and it forecloses
    a third money source.
15. **The blast radius is inverted between the two options, and this is why the
    shared ledger won.** The Payouts rollup (`convex/ledger.ts`) groups by
    `sellerId`, so donations appear there for free — that is the machinery being
    reused. The two Sales-tab queries (`convex/sales.ts`) group by `topicId` and
    fetch a course title, so they need an explicit branch. A separate `donations`
    table would have inverted that: Sales free, but Payouts and `markPaid` forced
    to span two tables.
16. **Donations are excluded from the Sales report.** It reports revenue per course
    per edition; a donation has no course, and folding it in corrupts per-course
    numbers. Donations surface in Payouts and nowhere else.

### Per-tenant configuration

17. **A reusable, flag-gated section — not ywampotch-only.** A sixth tenant flag
    joins `tenantFlagsValidator`; since all five existing flags are **required**
    booleans, this needs a **backfill migration** over every tenant row.
18. **`donationPayee: v.optional(v.id("users"))` on the tenant row, sys-admin-only
    to write** — following ADR 0026's reasoning that a money destination is not a
    subdomain administrator's call. Letting a tenant admin set it would open a
    self-dealing surface: redirecting the tenant's donation income to any member
    account.
19. **The flag cannot be switched on unless the payee `isReadySeller`** (granted +
    SA bank details on file — `convex/sellerStatus.ts`). This makes it structurally
    impossible to accrue donation debt with nowhere to send it.
20. **ywampotch's landing page is bespoke, so the shared section must be *placed*
    in `YwamPotch.tsx` by hand.** The flag controls whether it renders, not where.
21. **All three numbers are global committed constants** — `DONATION_FEE_BPS = 1000`,
    the USD→ZAR rate, and a minimum donation. The minimum is not cosmetic: PayFast's
    per-transaction fee makes a $1 donation mostly fee, so the floor protects the
    payee's 90%.

### Flagged, not closed — merchant of record vs. a Section 18A receipt

**The operator receives the donation; the tenant does not.** Money lands in the
operator's account, the operator keeps 10% and pays 90% onward. Therefore **a donor
cannot obtain a Section 18A tax-deductible receipt from YWAM Potch for money YWAM
Potch never received**, and the received-then-passed-on amount may read as operator
revenue rather than a conduit. This is **structural, not a copy problem** — the only
fix is re-deciding merchant of record for donations, which reverses ADR 0026 and is
its own effort. Not legal advice; worth an accountant's five minutes before go-live.
The widget's "not a tax-deductible receipt" line (9) is the mitigation, not a
solution.

### Ruled out of this effort

- **Recurring / monthly giving** — its own ticket
  ([Recurring monthly giving](06-recurring-monthly-giving.md)). It collides with the
  Guest decision: an anonymous donor has **no account to cancel a subscription
  from**, so it forces either a tokenised manage-link or a split rule (one-off is
  Guest, monthly is auth-first).
- **EFT donations.** Card-only. The EFT rail's human-typed reference exists to
  reconcile a *known* price against a bank statement; a donor-chosen arbitrary
  amount is materially harder to match by hand.
- **A donation popup on Public links** (`/share/[token]`) — the ticket's original
  second idea. It interrupts a Guest mid-lesson, and it is the one place ADR 0013's
  queries-only Guest seam would have to be reasoned about again.

### Handoff — this is decided, NOT built

**Nothing above exists in code yet.** This ticket is resolved because the *decision* is
resolved; the build is two separate tickets, deliberately, so the map shows that difference
at a glance (chartr derives one status per file, so decided-but-unbuilt work can only be
visible as its own unstarted star):

- [Build the donation rail — backend, config and ADR 0027](07-build-donation-rail-backend.md)
- [Build the donation widget and landing section](08-build-donation-widget-and-landing-section.md)

Both say to read this Answer first and to **grill rather than invent** where a detail is not
written here — because a detail not written here was not decided.
