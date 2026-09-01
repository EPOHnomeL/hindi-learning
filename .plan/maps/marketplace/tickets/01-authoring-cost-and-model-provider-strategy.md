---
type: grilling
blocked_by: []
---

# Authoring-cost funding & model-provider strategy

## Question

**Where it stands:** needs-info (deferred — owner is monitoring real authoring cost before deciding)

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (**Seller**, **Entitlement**, **Managed line**, **BYOK line**). Decisions: [ADR 0014](../../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) (two lines / gateway), [ADR 0016](../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace). Costing context: `../../product-direction/ROADMAP.md`.

## Want

Decide **who funds the up-front authoring cost of a paid course**, and settle the
**model-provider strategy** that underpins it. Deferred out of the 2026-07-06
grilling session: the owner will **monitor real authoring cost first** rather than
commit blind. A paid course must be fully authored *before* it is listed
([ADR 0016](../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)),
so this cost is spent up front, on a course that may or may not sell.

**Translation cost is the same problem, one layer out.** Selling in a specific language
means selling an **Edition**, and translated Editions are produced on the *operator's*
Claude key (course-translation feature). So a sold translated Edition carries an
operator cost the platform's cut must recoup — the same funding question as authoring,
and it should be answered together.

## Open questions to resolve

- **Who funds authoring** (the fork parked in the grilling):
  1. **Seller-BYOK** — the Seller brings their own key/model and pays to author;
     the platform's Connect application fee is then pure margin on sales, zero
     operator cost exposure. Most consistent with "Sellers are independent
     merchants" ([ADR 0016](../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)).
  2. **Operator-funded** — the operator eats the authoring bill on their Claude
     key and bets the take-rate recoups it. Frictionless for Sellers, but
     unbounded per-course cost with no guaranteed sale.
  3. **Operator-funded, metered** — the operator authors on Claude (Managed line)
     but meters and bills the Seller for the compute, separate from the sales cut.
     Recovers cost regardless of sales, but requires building the Phase-1
     metering/billing now and charges the Seller twice.
- **Model-provider investigation** (the "any other ways" the owner still wants to
  explore before choosing):
  - **BYOK line** implementation ([ADR 0014](../../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)):
    per-owner encrypted key storage, scoping, never-logged.
  - **OpenRouter** as the OpenAI-compatible gateway ("add a vendor" = model string
    + key field).
  - **Browserbase** for the ported teaching runtime's browser/rendering needs
    (resource fetch/render, browser-tool use) once the loop is off Claude Code.
  - **Gemini** path — a concrete non-Claude model, *reachable* via the gateway but
    quality is the customer's responsibility (per [ADR 0014](../../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)).

## Prerequisite

- **Cost instrumentation** (ROADMAP Phase 0, item 6): capture real tokens-per-lesson
  per authoring run. This turns the costing *formula* into a real per-course number
  and is the data the funding decision waits on.

## Notes

- This does **not** block the paygate spine (Stripe Connect wiring, the Entitlement
  model, the "Can Sell" grant, checkout). Those can ship while funding is monitored,
  because the funding choice affects *economics*, not the *access mechanics*.

## Done when

The who-funds-authoring fork is closed and the model-provider strategy is settled, decided against real cost-instrumentation numbers rather than blind.

<!-- Migrated 2026-07-30 from GitHub issue #80 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

---

## Context folded from the retired `paid-marketplace` map (2026-08-01)

<!-- was .plan/maps/marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md; that single-ticket map was consolidated into marketplace -->

- **Deliberately deferred, not stalled.** The owner is monitoring real authoring cost before
  committing. The blocking data is per-run token instrumentation —
  [Cost instrumentation](../../technical-foundation/tickets/12-cost-instrumentation.md).
  Take that first; this cannot honestly resolve without it.
- **The cost is spent up front on a course that may never sell:** ADR 0016 requires a paid
  course to be fully authored *before* it is listed.
- **Translation is the same problem one layer out.** Selling in a language means selling an
  Edition, and translated Editions are produced on the operator's key — so a sold translated
  Edition carries an operator cost the platform cut must recoup. Answer both together.
- **The fork, from the original grilling:** Seller-BYOK (zero operator exposure, most
  consistent with ADR 0016's independent-merchant framing) / operator-funded (frictionless,
  unbounded exposure) / operator-funded-but-metered (recovers cost, but needs metering built
  now and charges the Seller twice).
- **This does not block the paygate spine.** Stripe Connect wiring, the Entitlement model, the
  can-sell grant, and checkout can all ship while funding is monitored — the funding choice
  affects economics, not access mechanics.
- Downstream consumers of whatever this decides:
  [Interactive AI chat substrate](../../pedagogy/tickets/04-interactive-ai-chat-substrate.md)
  (per-learner chat cost),
  [Self-serve course building](../../course-authoring/tickets/03-self-serve-course-building.md)
  (a self-serve generate button is a metered cost per click),
  [Scope course audio](../../media-generation/tickets/02-scope-course-audio.md) (TTS per Edition).
- Skills: `/grilling`; ADR 0014 and ADR 0016 are the standing decisions.
- **Fog:** BYOK key storage mechanics (per-owner encrypted, scoped, never logged) — a real
  build named in ADR 0014, only worth ticketing if the BYOK branch wins.
- **Out of scope:** the paygate access mechanics — already decided and shipping.
