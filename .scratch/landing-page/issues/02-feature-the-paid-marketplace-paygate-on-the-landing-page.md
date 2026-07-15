# landing-page/02: Feature the paid marketplace (paygate) on the landing page

**Status:** open
**Labels:** needs-triage
**Imported:** from GitHub #29 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/landing-page/issues/02-feature-paygate-on-landing.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/landing-page/issues/02-feature-paygate-on-landing.md) on 2026-07-10. Relative links in the text resolve against that file's location.

# 02 — Feature the paid marketplace (paygate) on the landing page

Status: needs-triage (to-scope — captured 2026-07-08; **blocked on merging `feat/paid-marketplace`**)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Seller, Entitlement, Preview, Edition, Public link, Guest, Allowlist, Admin). Direction: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace via Stripe Connect facilitator). Full scope already lives on the **`feat/paid-marketplace`** branch: `.scratch/paid-marketplace/PRD.md` + `issues/01–05`.

## Want

Keep the **paygate** as one of the landing page's headline features ([issue 01](01-marketing-landing-page.md)): "sell the courses you author — learners read the first lesson free, then buy lifetime access to an Edition." A marketplace/pricing section on the marketing page.

## Acceptance (to refine at triage)

- A **marketplace / pricing** section on the landing page that markets, accurately to [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md):
  - What is sold is an **Edition** — a `(Topic, language)` pair. The first Lesson is a free **Preview**; a one-time purchase grants a **lifetime Entitlement** to that Edition (every later Lesson + its References, in that language).
  - The platform **facilitates** payment (Stripe Connect, Express) and takes a cut; the **Seller** stays the merchant of record.
  - **Economics** (owner decisions, [[paid-marketplace-economics]]): 15% platform fee (`PLATFORM_FEE_BPS=1500`) — the Seller keeps ~85% — and **no refunds**. Don't market a refund policy.
  - Selling is a **two-gate capability**: Admin grants *can-sell*, then the Seller completes Stripe onboarding; only completed + published courses can be priced.
- **Gating.** The section only ships once `feat/paid-marketplace` is merged to `main` (owner will merge). Until then, keep it behind a flag or omit it — don't market a feature that isn't live.

## Depends on

- **Merge of `feat/paid-marketplace`** (ADR 0016) into `main`. The paygate code already exists on the branch: `convex/market.ts`, `convex/stripe.ts`, `src/app/_components/Paygate.tsx`.
- Landing page [issue 01](01-marketing-landing-page.md).
- The course-translation **Edition** model (selling is per-Edition).

## Notes

- This ticket is **only** the landing-page marketing surface + the merge reminder — it does **not** re-build the paygate (that's the branch's PRD + issues 01–05).
- To-scope only; not built.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding on main and still blocked as stated: no paygate/marketplace code on main (no market.ts/stripe.ts/Paygate.tsx, no Seller/Entitlement tables); `feat/paid-marketplace` exists on origin and is not merged.

### EPOHnomeL — 2026-07-12

The landing page itself shipped (#28, 53cc9e9) **without** a marketplace section, per this issue's gate — `feat/paid-marketplace` is still unmerged, so nothing unlive is being marketed. When the branch merges, this becomes: add one more card/section to `src/app/_components/Landing.tsx` (the feature grid + a pricing blurb slot in naturally). Heads-up for whoever picks it up: the rail/fee details in the issue body have been superseded by later owner decisions — confirm the current economics before writing the copy.
