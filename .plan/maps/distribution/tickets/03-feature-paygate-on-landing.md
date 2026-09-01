---
type: task
blocked_by: []
---

# Feature the paid marketplace (paygate) on the landing page

## Question

**Where it stands (corrected 2026-08-18):** the gate this ticket was blocked on is **gone** — the
paid rail is on `main` and live — but **the rail that shipped is not the one this ticket's copy
describes**, so the ticket is open on accuracy grounds now rather than on availability grounds.
See "What changed under this ticket" below before writing a word of copy.

~~blocked on merging `feat/paid-marketplace`~~

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Seller, Entitlement, Preview, Edition, Public link, Guest, Allowlist, Admin). Direction: [ADR 0016](../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace via Stripe Connect facilitator). Full scope already lives on the **`feat/paid-marketplace`** branch: `.plan/maps/paid-marketplace/PRD.md` + `issues/01–05`.

## Want

Keep the **paygate** as one of the landing page's headline features (issue 01): "sell the courses you author — learners read the first lesson free, then buy lifetime access to an Edition." A marketplace/pricing section on the marketing page.

## Acceptance (to refine at triage)

- A **marketplace / pricing** section on the landing page that markets, accurately to [ADR 0016](../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md):
  - What is sold is an **Edition** — a `(Topic, language)` pair. The first Lesson is a free **Preview**; a one-time purchase grants a **lifetime Entitlement** to that Edition (every later Lesson + its References, in that language).
  - The platform **facilitates** payment (Stripe Connect, Express) and takes a cut; the **Seller** stays the merchant of record.
  - **Economics** (owner decisions, [[paid-marketplace-economics]]): 15% platform fee (`PLATFORM_FEE_BPS=1500`) — the Seller keeps ~85% — and **no refunds**. Don't market a refund policy.
  - Selling is a **two-gate capability**: Admin grants *can-sell*, then the Seller completes Stripe onboarding; only completed + published courses can be priced.
- **Gating.** The section only ships once `feat/paid-marketplace` is merged to `main` (owner will merge). Until then, keep it behind a flag or omit it — don't market a feature that isn't live.

## Depends on

- **Merge of `feat/paid-marketplace`** (ADR 0016) into `main`. The paygate code already exists on the branch: `convex/market.ts`, `convex/stripe.ts`, `src/app/_components/Paygate.tsx`.
- Landing page issue 01.
- The course-translation **Edition** model (selling is per-Edition).

## Notes

- This ticket is **only** the landing-page marketing surface + the merge reminder — it does **not** re-build the paygate (that's the branch's PRD + issues 01–05).
- To-scope only; not built.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding on main and still blocked as stated: no paygate/marketplace code on main (no market.ts/stripe.ts/Paygate.tsx, no Seller/Entitlement tables); `feat/paid-marketplace` exists on origin and is not merged.

### EPOHnomeL — 2026-07-12

The landing page itself shipped (#28, 53cc9e9) **without** a marketplace section, per this issue's gate — `feat/paid-marketplace` is still unmerged, so nothing unlive is being marketed. When the branch merges, this becomes: add one more card/section to `src/app/_components/Landing.tsx` (the feature grid + a pricing blurb slot in naturally). Heads-up for whoever picks it up: the rail/fee details in the issue body have been superseded by later owner decisions — confirm the current economics before writing the copy.

## What changed under this ticket (2026-08-18, verified in the tree)

The 2026-07-10 and 2026-07-12 comments below are both superseded. Re-verified on `main` @
`bf04257`:

- **The paid marketplace is on `main`.** `convex/market.ts`, `convex/entitlements`-backed access
  and `src/app/_components/Paygate.tsx` all exist. The merge gate this ticket hung on has
  cleared, so nothing about it is blocking any more.
- **It is PayFast, not Stripe Connect, and the platform is the merchant** — not the Seller as
  merchant of record. There is no `convex/stripe.ts`. ADR 0016's rail is not what shipped, which
  is exactly why
  [Supersede ADR 0016 — the money model that actually shipped](../../technical-foundation/tickets/14-adr-superseding-0016-payfast-merchant-model.md)
  exists and is still open.
- **A second rail exists that this ticket never knew about:** manual EFT bank transfer
  (ADR 0026), with `fee: 0` and `net == gross`. Any pricing section that names one payment
  method is already wrong.
- **Pricing is regional.** `convex/regions.ts` + `convex/regionalPricing.test.ts` carry three
  price points, and checkout shows the buyer their regional price and the Rand it charges
  (`dc9db73`, 2026-08-06). "One price, 15% fee" is no longer a complete description.
- **The certificate is no longer sold** (`feat(landing): restructure my-course.app, and stop
  selling the certificate`, 2026-08-07).
- **A tenant landing already carries a buy CTA:** `src/app/_landing/YwamPotch.tsx` sells
  Prophetic School. The *default* host's `Landing.tsx` deliberately does not — its comment says
  there is "nothing to sell" there — so the shared-block-vs-per-tenant question in the folded
  context below is now half-answered by what shipped, and should be read as such.

**Practical consequence:** this ticket should not be worked before ticket 09 settles the money
model, or the copy will be written against an ADR that is about to be superseded. That is a
sequencing note, not a `blocked_by` edge — 09 is a decision and this is a marketing surface, and
whoever picks this up may reasonably decide the copy can describe the shipped rail directly.

## Done when

~~A marketplace/pricing section markets the paygate accurately to ADR 0016 — 15% fee, no refunds,
Edition-grain Entitlement, free first-Lesson Preview — and it only ships once the paid-marketplace
work is on `main`.~~

**Restated 2026-08-18,** because both halves of the sentence above went stale: the `main` gate has
cleared, and ADR 0016 is no longer the accurate description of the rail. A marketplace/pricing
section on the **default host's** landing page markets the money model *as it actually ships* —
both rails (PayFast card and manual EFT), regional pricing, Edition-grain Entitlement, free
first-Lesson Preview, no refunds, platform-as-merchant — with no claim traceable only to ADR 0016,
and no certificate on sale.

<!-- Migrated 2026-07-30 from GitHub issue #77 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

---

## Context folded from the retired `landing-page` map (2026-08-01)

<!-- was .plan/maps/distribution/tickets/03-feature-paygate-on-landing.md; that single-ticket map was consolidated into marketplace. Ticket 01 of the original landing-page effort (the marketing landing page itself) shipped before the migration; its number is retired. -->

- **Accuracy is the constraint, not copywriting.** ADR 0016 fixes the facts: Edition-grain
  sale, free first-Lesson Preview, lifetime Entitlement, Stripe Connect facilitator with the
  Seller as merchant of record, 15% platform fee (`PLATFORM_FEE_BPS=1500`), and **no refunds**
  — so do not market a refund policy.
- **Selling is a two-gate capability:** an Admin grants can-sell, then the Seller completes
  onboarding. Only completed and published courses can be priced. Marketing copy that implies
  one-click selling is wrong.
- **Hard gate:** the section stays behind a flag or omitted until the paid-marketplace work is
  on `main`. Never market a feature that is not live.
- Per-tenant landing pages already exist (`src/app/_landing/registry.ts`) — decide whether
  this section is one shared block or per-tenant.
- Adjacent: [Marketplace/discover component](02-marketplace-discover-component.md) (the actual
  course listing) and
  [Scope the onboarding & marketing video](../../media-generation/tickets/03-scope-onboarding-and-marketing-video.md)
  (a demo would plausibly live on this page).
- **Out of scope:** the paygate mechanics themselves — ADR 0016 and the paid-marketplace work
  own those.

<!-- Moved 2026-09-01 from marketplace/04 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history.  -->
