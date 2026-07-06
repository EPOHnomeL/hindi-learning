# 01 — Authoring-cost funding & model-provider strategy

Status: needs-info (deferred — owner is monitoring real authoring cost before deciding)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Seller**, **Entitlement**, **Managed line**, **BYOK line**). Decisions: [ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) (two lines / gateway), [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace). Costing context: [`../../product-direction/ROADMAP.md`](../../product-direction/ROADMAP.md).

## Want

Decide **who funds the up-front authoring cost of a paid course**, and settle the
**model-provider strategy** that underpins it. Deferred out of the 2026-07-06
grilling session: the owner will **monitor real authoring cost first** rather than
commit blind. A paid course must be fully authored *before* it is listed
([ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)),
so this cost is spent up front, on a course that may or may not sell.

## Open questions to resolve

- **Who funds authoring** (the fork parked in the grilling):
  1. **Seller-BYOK** — the Seller brings their own key/model and pays to author;
     the platform's Connect application fee is then pure margin on sales, zero
     operator cost exposure. Most consistent with "Sellers are independent
     merchants" ([ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)).
  2. **Operator-funded** — the operator eats the authoring bill on their Claude
     key and bets the take-rate recoups it. Frictionless for Sellers, but
     unbounded per-course cost with no guaranteed sale.
  3. **Operator-funded, metered** — the operator authors on Claude (Managed line)
     but meters and bills the Seller for the compute, separate from the sales cut.
     Recovers cost regardless of sales, but requires building the Phase-1
     metering/billing now and charges the Seller twice.
- **Model-provider investigation** (the "any other ways" the owner still wants to
  explore before choosing):
  - **BYOK line** implementation ([ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)):
    per-owner encrypted key storage, scoping, never-logged.
  - **OpenRouter** as the OpenAI-compatible gateway ("add a vendor" = model string
    + key field).
  - **Browserbase** for the ported teaching runtime's browser/rendering needs
    (resource fetch/render, browser-tool use) once the loop is off Claude Code.
  - **Gemini** path — a concrete non-Claude model, *reachable* via the gateway but
    quality is the customer's responsibility (per [ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)).

## Prerequisite

- **Cost instrumentation** (ROADMAP Phase 0, item 6): capture real tokens-per-lesson
  per authoring run. This turns the costing *formula* into a real per-course number
  and is the data the funding decision waits on.

## Notes

- This does **not** block the paygate spine (Stripe Connect wiring, the Entitlement
  model, the "Can Sell" grant, checkout). Those can ship while funding is monitored,
  because the funding choice affects *economics*, not the *access mechanics*.
