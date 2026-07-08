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
