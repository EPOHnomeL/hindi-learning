# YWAM Potch launch — fix the funnel + manual EFT rail

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand.
     Full reasoning and the decisions behind all of it: spec.md -->

## Destination

A stranger can land on `ywampotch.my-course.app`, understand the offer, sign in,
find Basic Tswana, pay **by card or by EFT**, and read lesson one — without the
product changing its name half way through.

Driven by two diagnosed funnel leaks: **checkout abandonment** and **sign-up
friction**. PayFast itself is live and working (5 real purchases); the rail is
not the problem and must not be touched.

Extended 2026-08-01 with two more essentials: a **Shoprite-Send-simple
checkout** (Unlock full course → sign in/up → "How do you want to pay?"
(RSA EFT / Visa incl. international) → straight to that method's details), and
**regional pricing** — $10 US, €10 EU, R100 everywhere else.

## Build order

Strictly sequential — see [spec § Execution](spec.md). File overlap is high
(`SignIn.tsx` spans two units, `market.ts` and `AdminPanel.tsx` span three) and
the auth pair is hard-blocked, so parallelism buys little and costs attributable
history on a repo that now handles real money.

| # | Unit | Where | State |
|---|---|---|---|
| — | Link OAuth sign-in to an existing account by email | **GitHub [#111](https://github.com/EPOHnomeL/hindi-learning/issues/111)** | built `fbb4746` |
| — | Google provider + sign-in button | **GitHub [#112](https://github.com/EPOHnomeL/hindi-learning/issues/112)** | built `f5a3be9` |
| 01 | Brand continuity through the funnel | [01](tickets/01-brand-continuity-through-the-funnel.md) | built `1ffa433` |
| 02 | Operator bank details as an admin-editable settings record | [02](tickets/02-operator-bank-details-settings-record.md) | built `2632b7e` |
| 03 | Buyer flow — Pay by EFT intent + reference | [03](tickets/03-buyer-pay-by-eft-intent-and-reference.md) | built `3adb7e6` |
| 04 | Admin confirm queue — grant + Ledger row | [04](tickets/04-admin-eft-confirm-queue.md) | built `eb6a836` |
| 05 | EFT confirmation email | [05](tickets/05-eft-confirmation-email.md) | built `84d793a` |
| 06 | ADR for the manual EFT rail (+ glossary term) | [06](tickets/06-adr-manual-eft-rail.md) | built — [ADR 0026](../../../docs/adr/0026-manual-eft-payment-rail.md) |
| 07 | Prod-verify the security fixes | [07](tickets/07-prod-verify-security-fixes.md) | **open — needs a human on prod** |
| 08 | Fix the four known stale facts | [08](tickets/08-fix-known-stale-docs-and-tracker.md) | open |
| 09 | Shoprite-Send checkout — method chooser + step rail | [09](tickets/09-shoprite-send-checkout-method-chooser.md) | built `27ba5bd` |
| 10 | Research — non-ZAR charging + buyer geo | [10](tickets/10-research-non-zar-charging-and-geo.md) | answered |
| 11 | Regional pricing mechanism ($10/€10/R100) | [11](tickets/11-regional-pricing-mechanism.md) | **open — next; grilling, needs the operator** |

The strict sequencing above applied to units 01–06, which shared files and are
done. The 2026-08-01 additions are a second strand: 09 stood alone (a
presentation reshape of `Paygate.tsx`, `convex/` untouched), 10 was AFK
research, and 11 now grills on its facts. Regional-pricing *implementation* is
deliberately not ticketed yet — see Not yet specified.

**Before the rail can take a cent on prod**, a sys admin must open the Payouts tab
and fill in the EFT collection account, then tick "Offer Pay by EFT to buyers" —
the rail ships **off**, and the buyer-facing button does not exist until it is on.

**Why the first two are on GitHub.** They predate the 2026-07-29 tracker split
(`docs/agents/issue-tracker.md`) and are already fully specced and labelled
`ready-for-agent` / `ready-for-human`. Grandfathered — build them where they are
rather than duplicating them locally and creating two sources of truth.

**#112 carries a human step that blocks it:** Google Cloud console redirect URIs
plus `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, set **separately on dev and prod**.
It also needs an acceptance criterion that post-dates the issue — see
[spec § 1.2](spec.md), the ADR 0025 host-preservation check.

## Decisions so far

<!-- one line per resolved ticket -->

- [Brand continuity through the funnel](./tickets/01-brand-continuity-through-the-funnel.md) —
  the premise was already stale: only **`CourseShell`** actually lacked a mark.
  `SignIn` and `Dashboard` were deliberately **left alone** — routing them through
  `<Brand>` would have *removed* the motto and shrunk the logo, and their bespoke
  lockups already meet the criteria. Not in the mobile top bar either (a fixed
  `h-12` with an already-truncating title).
- [Operator bank details as a settings record](./tickets/02-operator-bank-details-settings-record.md) —
  **one global record, not per tenant**, with an explicit `enabled` toggle; writes
  gated on `isCallerAdmin(ctx)`, buyer-facing read returns details only while
  enabled. The disclosure of bank details to any signed-in user while enabled is
  intentional and documented at the query.
- [Buyer flow — Pay by EFT intent + reference](./tickets/03-buyer-pay-by-eft-intent-and-reference.md) —
  a **separate `eftIntents` table** is what keeps the PayFast path untouched.
  Reference is topic-prefix + random suffix; creating an intent grants no access;
  a returning buyer sees pending state via the `market.checkoutStatus` pattern.
- [Admin confirm queue — grant + Ledger row](./tickets/04-admin-eft-confirm-queue.md) —
  Confirm mints the Entitlement and writes the Ledger row **atomically in one
  mutation**, mirroring `fulfillPurchase` (`fee: 0`, `net == gross`, split via
  `splitNet`), idempotent per reference *and* per `(buyer, Topic, language)`.
  Schema **widened**: `ledger.pfPaymentId` now optional, `ledger.eftRef` and
  `entitlements.eftRef` added — exactly one of the two per row, which is the
  provenance rule. No plan to narrow them back.
- [EFT confirmation email](./tickets/05-eft-confirmation-email.md) — exactly one
  Resend send per confirmation, deep-linked to the course on the **tenant's own
  host** (ADR 0025). Keeps `email.ts`'s no-op-with-warning when Resend is
  unconfigured, so a mail failure leaves the Entitlement and Ledger row intact;
  an idempotent repeat confirm sends nothing.
- [ADR for the manual EFT rail](./tickets/06-adr-manual-eft-rail.md) —
  [ADR 0026](../../../docs/adr/0026-manual-eft-payment-rail.md): the operator stays
  sole merchant-of-record, a manual sale mints a `fee: 0` Ledger row so Sales and
  Payouts stay whole, provenance is `eftRef` vs `pfPaymentId`, and manual per-sale
  reconciliation is the accepted cost. `CONTEXT.md` gained the glossary term.
- [Shoprite-Send checkout — method chooser + step rail](./tickets/09-shoprite-send-checkout-method-chooser.md) —
  the dialog now asks **"How do you want to pay?"** with options named by what
  the buyer *has* (South African bank transfer / Visa card incl. international),
  one click to each method's details. Gateway brand demoted to fine print. With
  the rail **off** the old single-button flow is untouched, and it keeps the
  `bankGuidance` note — with a chooser that note is answering a question already
  asked. Added the four-step rail (Create account → Choose method → Pay →
  Continue) on the sign-in screen *with the buy marker* and in the dialog; the
  rule for "which step" is `checkoutDerive.ts` — **paying begins when a method is
  started, not chosen**. `convex/` untouched. **Nobody has seen it yet** — it
  needs the rail enabled, so the visual check folds into ticket 07.
- [Research — non-ZAR charging + buyer geo](./tickets/10-research-non-zar-charging-and-geo.md) —
  PayFast is **ZAR-only for charge and settlement but already accepts
  international cards** (buyer's bank does the FX), so $10/€10 is a *presentment*
  problem, not a new-rail problem. PayFast markets a **Multi-Currency Pricing**
  feature — ask support whether our account qualifies **before** designing
  anything. Stripe is unavailable to SA entities; **Paddle** is the only real
  multi-currency option and would *reverse* ADR 0026's merchant-of-record
  decision. Geo is `x-vercel-ip-country` in middleware — **Convex cannot see it**
  and must be passed it; absent on localhost, defeated by VPNs.

## Not yet specified

- **Regional pricing implementation** — schema shape for per-region amounts,
  where the geo signal is read and passed, price-freeze invariant across both
  rails, seller/admin UI for the three price points. Can't be ticketed until
  the mechanism is decided. clears-with: 11

## Rules for this build

- **`tdd` then `ponytail`** on every ticket.
- **Tests seed only states production can actually produce.** Before writing a
  fixture, name the mutation that would create it; if there isn't one, the
  fixture is fiction. This is the direct lesson from the `users.tenantSlug`
  phantom-field bug, and it matters most on the EFT path, where a fictional
  fixture means a money bug the tests approve of.
- **Never touch the PayFast code path.** It holds real money.
- `git commit --only <paths>` after `git diff` of those paths. Never `git add -A`,
  never `--amend`. Push only when asked — pushing `main` deploys prod.

## Done when

One end-to-end claim, verified **on prod against the real tenant host** — not in
tests, not on localhost:

> A stranger opens `ywampotch.my-course.app`, signs in with Google, sees Basic
> Tswana in available courses, chooses Pay by EFT, receives a reference and bank
> details, transfers the money; the operator confirms it in the admin queue; the
> buyer receives an email and can read the course. The sale appears in the Sales
> tab and is `owed` to the seller in Payouts. The app is called YWAM Potch
> throughout.

Plus `pnpm typecheck` and `pnpm test` green — noting **two** pre-existing
failures that are not yours: the long-standing `convex/sales.test.ts` flake that
passes in isolation, and `scripts/bundle-authoring-assets.test.ts`, which has
failed since `d5f3dc2` added the justify media query to `lessons/_partials/`
without re-running `pnpm bundle:authoring`. The second is a real staleness, not
a flake — one command fixes it, and it belongs to whoever owns `d5f3dc2`.
