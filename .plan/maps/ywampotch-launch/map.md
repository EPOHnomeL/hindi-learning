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

Extended again 2026-08-01, after the operator walked the live flow: **checkout
stops being a popup**. It becomes its own mobile-first page — a flight-booking
wizard, step rail at the top showing what's done and what's left — serving both
entry paths (share link signed-out, published site signed-in). The step
*sequence* is right and does not change; the container and the phone treatment
do. Grilled to this shape before charting: the complaint is *"too much popups
and dialog"*, not the order of the steps.

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
| 07 | Prod-verify the security fixes | [07](tickets/07-prod-verify-security-fixes.md) | answered — both checks passed on prod |
| 08 | Fix the four known stale facts | [08](tickets/08-fix-known-stale-docs-and-tracker.md) | answered — four of five already fixed |
| 09 | Shoprite-Send checkout — method chooser + step rail | [09](tickets/09-shoprite-send-checkout-method-chooser.md) | built `27ba5bd` |
| 10 | Research — non-ZAR charging + buyer geo | [10](tickets/10-research-non-zar-charging-and-geo.md) | answered |
| 11 | Regional pricing mechanism ($10/€10/R100) | [11](tickets/11-regional-pricing-mechanism.md) | answered — decided, **not built** |
| 12 | Checkout as a page — route + step model | [12](tickets/12-checkout-page-route-and-step-model.md) | answered |
| 13 | Move the purchase out of `BuyDialog` onto the page | [13](tickets/13-move-purchase-out-of-buydialog.md) | built `f971945` — **operator's walk pending** |
| 14 | Phone-first pass — locked card and `SignIn` | [14](tickets/14-phone-first-pass-locked-card-and-signin.md) | built — **operator's walk pending** |
| 15 | Launch risk — rollback + prod walk-through | [15](tickets/15-checkout-page-launch-risk-and-prod-walk.md) | answered — no rollback armed; walk split to 18 |
| 16 | The EFT dead end — a way out, and somewhere to wait | [16](tickets/16-eft-dead-end-and-awaiting-payment.md) | built `14b3888` — **operator's walk pending** |
| 17 | The card buyer's payment-complete moment | [17](tickets/17-payment-complete-moment-on-card-return.md) | built `f8b55c3` — **operator's walk pending** |
| 18 | The operator's prod walk — both paths, both rails | [18](tickets/18-operators-prod-walk.md) | open — collects the four pending walks |
| 19 | One real EFT sale, end to end, on prod | [19](tickets/19-real-eft-sale-end-to-end-on-prod.md) | open — blocked by 18; the map's Done-when |
| 20 | Build regional pricing — backend + geo | [20](tickets/20-regional-pricing-backend.md) | built `35eb877` |
| 21 | Build regional pricing — seller + buyer surfaces | [21](tickets/21-regional-pricing-surfaces.md) | open — blocked by 20 |

The strict sequencing above applied to units 01–06, which shared files and are
done. The 2026-08-01 additions are a second strand: 09 stood alone (a
presentation reshape of `Paygate.tsx`, `convex/` untouched), 10 was AFK
research, and 11 grilled on its facts. **11 resolved 2026-08-06** and graduated
its implementation into **20 and 21**, which run strictly in that order (21
renders 20's chokepoint). 21 lands in the same surfaces as ticket 13, so it
inherits that merge.

**12–15 are a third strand**, opened the same day: 09 fixed the *wording* of the
method step but left it in a dialog, and once the operator could actually see it
the container was the complaint. 12 is the decision the other three hang off;
13 and 14 are independent of each other and can run in parallel once it closes.
**11 and 13 land in the same surface** — whichever ships second inherits the
merge.

**18 and 19 are what is left**, and they are the same person's afternoon in two
sittings: 18 is the buyer's half (taste, on a phone, stopping at Awaiting
payment), 19 is the operator's half and the map's Done-when (a real transfer,
confirm, email, Sales, Payouts). 19 was **missed at charting** — 02–05 built the
whole confirm side and every one of them was verified by tests and code-reading
only, so nothing on the map ever carried the claim its Done-when makes. Added
2026-08-01 by an audit session, not by a resolution.

**The EFT rail is ON in dev and prod** (operator confirmed 2026-08-01), so the
chooser, the bank-details panel and the pending state all render today. Earlier
notes on this map and in ticket 09 said the opposite — that the rail was enabled
nowhere and "nobody has seen it". That was true when written and is now false;
corrected here rather than left to mislead the next session.

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
  **Superseded 2026-08-06 on one point:** do *not* send the PayFast support query.
  Ticket 11 established MCP cannot express three different prices at all, so
  eligibility is irrelevant — see its entry below.
- [Checkout as a page — route + step model](./tickets/12-checkout-page-route-and-step-model.md) —
  **one route, `/checkout/<slug>/<lang>`, inside `(app)`** so `AppGate` renders
  `SignIn` *at that URL* for free — that is the entire answer for the signed-out
  share path, and the operator picked it over inlining a sign-in form into the
  wizard (new auth code on the money surface, in launch week). Sibling of
  `courses/`, so it inherits **no `CourseShell`** chrome. `lang` is a required
  **path segment**, because an implicit language is the prod checkout bug.
  Step state is internal — every step is server-derivable, so back/forward/refresh
  already work and per-step URLs buy nothing. **`buy=1` and `autoOpenBuy` are both
  deleted**; `Paygate`'s CTA becomes always a `<Link>` on both paths, and `SignIn`
  keys its rail off `pathname.startsWith("/checkout")`. Rail carries the four
  one-word steps and *nothing else* (the labels only fit a phone because it's
  empty); the summary, method chooser and reference live in the body. **No auth
  change** — `oauthRedirectUrl` validates host, never path. `convex/` untouched.
  Also settled **the payment-return landing** (was fog, needed no ticket): the
  return URL is minted server-side (`convex/market.ts:432`) to `/courses/<slug>`,
  so a card buyer never re-enters checkout — they land on the course with the
  reactive `ConfirmingBanner`, which *is* step 4 and is already right from the new
  route. `cancel_url` drops an abandoning buyer on the bare course index: accepted
  wart, fixing it would mean touching `convex/`. Ticket 15 still walks it on prod.

- [Move the purchase out of `BuyDialog` onto the page](./tickets/13-move-purchase-out-of-buydialog.md) —
  built as 12 designed it, `f971945`. `/checkout/<slug>/<lang>` is live
  (`CheckoutPage.tsx` + a five-line route file); `BuyDialog`, `useBuyMarker()`,
  `buyLink()` and `autoOpenBuy` are all deleted, `Paygate`'s CTA is one `<Link>`
  on both paths, and `SignIn` keys off `pathname.startsWith("/checkout")`.
  `git diff convex/` empty; the EFT-rail-off branch survives intact. **One
  consequence 12 didn't foresee:** on a *page*, a buyer who already holds the
  Edition is reachable — an EFT buyer watching the operator confirm, most of all
  — so `checkoutStep` grew a **fourth step** that wins over both payment states,
  and the page shows "This course is yours" instead of a chooser whose buttons
  would throw. That is the EFT rail's step 4, the counterpart of PayFast's
  `return_url`. **No purchase was completed and nothing was seen in a browser** —
  the operator's walk in dev is the bar, and it is still owed.

- [The EFT dead end — a way out, and somewhere to wait](./tickets/16-eft-dead-end-and-awaiting-payment.md) —
  found by the operator's dev walk of 13. The instructions panel had no exit, and
  a pending EFT buyer was **invisible to the whole app**: no Entitlement means
  `myPurchases` can't see them, so their course sat under Available at full price
  after they'd transferred real money. Built `14b3888`: a "Done" CTA to the
  overview, and an **Awaiting payment** section there (above Purchased, with the
  reference on the card) fed by a new read-only `eft.myPendingIntents` — which
  rides the `by_user_topic` userId prefix (no new index) and deliberately returns
  **no bank details**. Pending courses are filtered out of Available. Clears
  itself on confirmation, same transaction that mints the Entitlement.

**Correction to [ticket 12](./tickets/12-checkout-page-route-and-step-model.md),
found by the operator completing a real PayFast purchase.** 12 recorded the
payment-return landing as "already correct — the reactive `ConfirmingBanner` *is*
step 4". It isn't: that banner renders **only while the ITN is in flight**, and
the ITN lands in seconds, so the happy path shows the buyer nothing at all. The
generic first-open Welcome panel fills the gap instead, saying nothing about
money. Recorded here rather than by editing 12, whose reasoning was sound on what
was known then; the fix is [ticket 17](./tickets/17-payment-complete-moment-on-card-return.md),
and the operator has chosen its shape (a purchase variant of the Welcome panel).

- [The card buyer's payment-complete moment](./tickets/17-payment-complete-moment-on-card-return.md) —
  built `f8b55c3` (subject line mangled to `@`; real subject is the first body
  line). One panel owns the opening moment: **Payment complete** (check mark,
  start CTA) or **Confirming payment** (the old banner's pulsing dot and copy,
  start CTA withheld until the grant lands), picked by a pure `welcomeVariant` —
  so the generic Welcome can never also appear. Deliberately **not** gated on the
  `firstOpen` latch (a buyer who read the free Preview carries progress and is
  owed the receipt), holds a beat while the status resolves rather than flashing
  "confirming" at a buyer already paid, and falls through to orientation on a
  token naming no intent. Dismissal is scoped to the intent token, closing a hole
  the ticket didn't name: dismissal is per-tab-session and buying happens inside
  one session, so a pre-purchase dismissal would have silenced the receipt.
  `ConfirmingBanner` and its two `Reader` strings deleted, four `Welcome` keys
  added across all five locales. `convex/` untouched. **The operator's walk is
  still owed**, same bar as 13 and 16.

- [Phone-first pass — locked card and `SignIn`](./tickets/14-phone-first-pass-locked-card-and-signin.md) —
  a presentation-only pass, and it found **one real bug behind the ugliness**: the
  four-step rail **overflows a 320px phone**. Ticket 09 sized it against the 384px
  sign-in card, but the rail's own `px-4` box leaves ~256px on a small screen and
  `whitespace-nowrap` turns that into visible overflow — it fits a 375px iPhone and
  breaks an SE. Afrikaans is the longest locale, not French or Hindi as 09 guessed.
  Fixed by inverting the sizes — **the compact one is now the base**, `sm:` restores
  the roomier row — plus `px-2` on the rail's box in **both** hosts (`SignIn` and
  `CheckoutPage`'s `Shell`). On the `Paygate` card the price now comes **first** and
  stacks above a full-width CTA on a phone, because the old `flex-wrap` dropped it
  *under* the button that commits to it; `sm:flex-row-reverse` keeps the desktop
  shape unchanged. `SignIn` went from **zero** responsive classes to `min-h-svh`
  (not `vh` — the URL-bar jog), phone padding and type, and every tap target off
  40px onto 44. **All three render sites checked** — `AppGate`, `Landing` and
  `_landing/YwamPotch.tsx` — and none wraps or overrides `SignIn`'s classes, so the
  leak the ticket warned about lands identically and benignly on every tenant. No
  tokens, no scale, no breakpoint system. `convex/` untouched; 758/758 tests green.
  **The operator's walk is owed** — nothing was seen in a browser, and the 320px
  arithmetic is computed, not measured.

- [Prod-verify the security fixes](./tickets/07-prod-verify-security-fixes.md) —
  **both checks passed on prod, no failures, no follow-up tickets.** The
  2026-07-28 tenant-admin authorization batch did not over-tighten: a sys admin
  still has full function across all five Admin tabs. And `courseAssignment`
  returns a tenant admin `"available":[]` **in the payload** — read off the Convex
  WebSocket frame, not the UI, so the leak is closed server-side rather than
  merely unrendered. Two things worth carrying forward: the ticket's phrasing
  ("carries no `available` array") is wrong in a way that misleads — the key is
  always present and the gate empties it, so `[]` is the pass; and the read is
  *consistent with* the gate rather than proof of it, since prod's pool may be
  empty anyway (the discriminating sys-admin read wasn't done — see the ticket).
  **Ride-along:** all six outstanding whitelabel UI checks passed in the same
  sitting, clearing that map's entire pending list (`ae579ca`); **ticket 01**'s
  brand check (Brand continuity through the funnel) was not done and is still
  owed — named in prose, not linked, because a second link to 01 in this section
  reads as a second Decisions-so-far entry for it.

- [Launch risk — rollback and the prod walk-through](./tickets/15-checkout-page-launch-risk-and-prod-walk.md) —
  the ticket's premise was stale: **the checkout page has been on prod since
  2026-08-01 afternoon** (`f971945`, `14b3888`, `f8b55c3` all rode the push that
  built `344c933`); only ticket 14's `00c78c5` is unpushed. **Decided: no rollback
  is armed, forward-fix is the policy** — the operator's call. The hatch is written
  down anyway: **Vercel instant rollback**, whose *only* candidate is
  `dpl_A2qJk7…` = `ae3f1d3` (pre-strand, dialog-era), safe against Convex because
  the strand's entire backend surface is one additive read-only query — but it
  retreats to *known-degraded*, reinstating the EFT dead end and dropping the
  payment moment. A `git revert` (4 commits, `convex/` dirty from a concurrent
  session) is morning cleanup, not a 9pm undo; a `BuyDialog` flag is strictly
  dominated by the rollback. **The PayFast return needs no change** — it's minted
  server-side to `/courses/<slug>` and never mentioned checkout; the params survive
  the deeper resume-lesson redirect and 17's panel fires after it. **Corrects
  ticket 12**: `cancel_url` lands on the *course page* with the Preview readable,
  not the "bare course index" — a smaller wart than recorded, needing no fix.
  14's `SignIn` diff is class strings only, so the other-tenant leak cannot be
  functional. The prod walk itself is the operator's and is split out as ticket
  18, The operator's prod walk — named in prose, not linked, because a
  `tickets/NN` link in a Decisions-so-far bullet reads to the parser as an entry
  for that ticket, and 18 is open. It is linked from the Build order table above.

- [Regional pricing mechanism ($10/€10/R100)](./tickets/11-regional-pricing-mechanism.md) —
  **the $10 is price discrimination, not a translation**: R100 ≈ $5.50, so "$10 for
  US buyers" is roughly *double* the base price, and the operator confirmed that is
  the intent. Everything follows. **Charge stays ZAR on PayFast** — $10 is a display
  price, the bank does the FX, Paddle rejected (reverses ADR 0026, weeks, launch
  week), **so no ADR is needed**. The **PayFast support query ticket 10 ordered is
  dead and must not be sent**: MCP is *structurally* incapable of this, not merely
  maybe-ineligible — it converts *out of* a ZAR base at a live rate, so R100 shows a
  US buyer ≈$5.50, and it can only ever restate one price, never hold three. MCP
  stays off, matching marketplace/03, so exactly one conversion is ever in play.
  **Prices live per-listing**: `listings` grows optional `usdAmount`/`eurAmount` in
  the **foreign** currency's minor units, seller-typed, absent = fall back to base
  (no backfill). Global constants were rejected for a concrete bug — they would make
  a second seller's R500 course also $10 in the US. The foreign side is exact and
  Rand derives at intent time from a **committed rate constant shared with
  marketplace/03**, which is the reconciliation this ticket demanded. **Geo is
  `x-vercel-ip-country`, absent → base price** — failing to the *cheapest* price is
  the safe direction; a VPN defeats it and that is accepted, with no region picker
  (it would hand everyone the cheap price). **"EU" is Western Europe** — the 27 plus
  GB/CH/NO/IS, all in euros; a £ point was declined. **EFT is hidden outside ZA**,
  server-enforced, because "EFT stays R100" would hand a US buyer a 45% discount for
  clicking the other button. The **anti-surprise line is in** — "$10.00 — charged as
  R180.00 (ZAR)" — reversed from the operator's first answer on a re-ask, because the
  donation widget on the same tenant landing page already discloses its Rand line and
  the two would have contradicted. The freeze invariant needs **no new mechanism**:
  both rails already freeze from `editionPrice()`, so only the number reaching that
  insert changes, and the server computes it from the `country` argument — the client
  never sends an amount. **Decided, NOT built**; the build is tickets 20 and 21.

- [Build regional pricing — backend + geo](./tickets/20-regional-pricing-backend.md) —
  built `35eb877`, and **it is far smaller than 11 implied**: two pure functions
  (`convex/regions.ts`) plus one optional `country` argument on each rail. No new
  table, no index, no migration, no backfill — `listings` grew two optional
  foreign-currency fields and an unset one falls back to the base price, so every
  listing that predates the feature keeps working untouched. Both rails already
  froze the shown price from one chokepoint, so only the number reaching that
  insert changed. **`USD_ZAR_RATE` now lives in `convex/rates.ts`**, moved out of
  the donation rail and re-exported: ADR 0027 had *shipped* while 11 was still
  open, which is what made ticket 11's shared-constant reconciliation real rather
  than aspirational. **Two deviations from the ticket, both simplifications.**
  There is **no middleware change and the ticket was wrong to ask for one** —
  `x-vercel-ip-country` is already on the incoming request and Vercel overwrites
  it at the edge, so a server component reads it from `headers()` directly; the
  delete-and-restamp was cargo-culted from `x-tenant-slug`, which needs it only
  because it is *derived* from Host. A comment in `src/middleware.ts` records
  that so it doesn't get re-added. And **the EFT gate asks "is this buyer paying
  the base price?", not "is this country ZA"** — same arbitrage closed, but it
  cannot drift from the pricing rule, and a no-header caller still gets through,
  which matters because localhost sends no country and the operator's dev walk of
  that rail is owed. 13 new tests, 813/813 green, `git diff convex/payfast.ts`
  empty. **Nothing is buyer-visible yet** — that is ticket 21.

- [Fix the four known stale facts](./tickets/08-fix-known-stale-docs-and-tracker.md) —
  **four of the five were already fixed, and the ticket had itself gone stale.** The
  `project-context.md` PayFast block was corrected by `8c7d29c` on 2026-07-29, the day
  *before* this ticket was transcribed from the spec; #52 and #53 were closed on GitHub
  on 2026-07-30. No operator confirmation was needed — the live facts were already
  written down. The two that were real had **moved house**: the 2026-07-30 GitHub
  retirement migrated #113 and #46 into `.plan/` and deleted them, so "close #113" was
  never possible. #113 is now
  [the onboarding map's welcome-panel ticket](../onboarding/tickets/02-first-open-welcome-panel.md),
  which had sat open on a panel shipped 2026-07-28 — **resolved there on the evidence**.
  #46 is that map's *Improve Onboarding Flow*, **scoped rather than closed** (its
  Destination hangs off it) into a concrete cold-sign-up walk — named in prose, not
  linked, because it is open. No ADR edited. Two hazards carried forward: any surviving
  `#NN` in `.plan/` points at a deleted issue and must be chased through the
  `<!-- Migrated … -->` footer instead, and this ticket's own handoff target
  `.scratch/docs-reconciliation/HANDOFF.md` is **not git-tracked**, so the systematic
  sweep it defers to is invisible to a fresh clone.

## Not yet specified

- ~~**Regional pricing implementation**~~ — graduated 2026-08-06 when 11 resolved;
  it lives on as tickets 20 and 21 in the Build order table.

## Out of scope

- **Reshaping the checkout journey itself** — fewer screens, or letting a
  stranger pay before making an account (which would reopen ADR 0021's
  auth-first rule). Grilled 2026-08-01 and ruled out: the operator's complaint
  is the container, not the sequence, and days of runway is the wrong week to
  reopen a decision that governs the money path.
- **A design system, shared tokens, a type scale or a breakpoint set** — this
  strand is bespoke and disposable by decision. [ui-overhaul](../ui-overhaul/map.md)
  owns the foundation, is foundation-first and planning-only, and ranks
  Paygate/checkout its **#4 worst surface** already. It will redesign these
  screens properly later; this strand deliberately does the work twice rather
  than making a launch wait on buying Mobbin Pro and picking a design system.

## Rules for this build

- **`tdd` then `ponytail`** on every ticket.
- **Tests seed only states production can actually produce.** Before writing a
  fixture, name the mutation that would create it; if there isn't one, the
  fixture is fiction. This is the direct lesson from the `users.tenantSlug`
  phantom-field bug, and it matters most on the EFT path, where a fictional
  fixture means a money bug the tests approve of.
- **Never touch the PayFast code path.** It holds real money.
- **Tickets 12–18 judge by the operator's eye, not a checklist.** They walk the
  flow and say what to change; iterate until they're happy. No reference design
  to match, no acceptance rubric — taste is the bar and it is theirs. Ticket 18
  is that walk, on prod, collecting the four that stand pending.
- **12–15 are bespoke and disposable.** Style the checkout surfaces well; do not
  extract shared tokens, scales or breakpoint systems. See Out of scope.
- **`SignIn` is in scope in full and it leaks.** It renders in `AppGate`,
  `Landing` and `_landing/YwamPotch.tsx` — restyling it changes every signed-out
  visitor on every tenant, not just YWAM Potch buyers. Check all three.
- `git commit --only <paths>` after `git diff` of those paths. Never `git add -A`,
  never `--amend`. Push only when asked — pushing `main` deploys prod.
- **No rollback is armed; forward-fix.** Standing decision from ticket 15, the
  operator's. The checkout page is *already on prod* — a session that finds a
  fault fixes it forward rather than reaching for an undo. The one hatch that
  exists (Vercel instant rollback to `ae3f1d3`) is documented in 15's Answer and
  retreats to known-degraded, so it is an emergency, not a workflow.
- ~~**Ticket 14's `00c78c5` is unpushed and pushing it deploys prod.**~~ **Stale
  as of 2026-08-01 evening: `00c78c5` is on `origin/main` and therefore on prod**,
  and prod has since moved several commits further (the marketplace donation rail
  rode the same branch). The two-pass structure ticket 18 was written around is
  gone — the whole strand, 14 included, is live and 18 is now a single walk.
  Everything else in 15's hatch still holds: before any push, note the Vercel
  rollback target and re-check it survived the build.

## Done when

One end-to-end claim, verified **on prod against the real tenant host** — not in
tests, not on localhost:

> A stranger opens `ywampotch.my-course.app`, signs in with Google, sees Basic
> Tswana in available courses, chooses Pay by EFT, receives a reference and bank
> details, transfers the money; the operator confirms it in the admin queue; the
> buyer receives an email and can read the course. The sale appears in the Sales
> tab and is `owed` to the seller in Payouts. The app is called YWAM Potch
> throughout.

Plus `pnpm typecheck` and `pnpm test` green — noting **one** pre-existing failure
that is not yours: the long-standing `convex/sales.test.ts` flake that passes in
isolation. `scripts/bundle-authoring-assets.test.ts` was the second until
`6588d8c` regenerated the bundle `d5f3dc2` had left stale; it passes now, and a
session that sees it fail again should re-run `pnpm bundle:authoring` rather than
treat it as known.
