# Provider-agnostic teaching runtime with two compute lines: a managed Claude line (quality-guaranteed) and a BYOK gateway line (any OpenAI-compatible model)

Status: proposed (not yet built — product-direction decision from the 2026-06-30 grilling session)

The teacher is re-expressed as a **programmatic, provider-configurable agent
runtime** fronted by an **OpenAI-compatible gateway**, replacing the
Anthropic-only claude.ai Routine. Two product lines ride the same runtime: a
**Managed line** (operator-run compute on Claude, tuned and quality-guaranteed,
billed to the customer) and a **BYOK line** (the customer supplies any
OpenAI-compatible key + model, configures it themselves, and owns quality on
non-Claude models).

## Context

[ADR 0010](0010-teaching-compute-swappable-adapter.md) kept the teacher as a
shared **claude.ai Routine** for the 4-User alpha and named **per-owner
Agent-SDK workers** as the Phase-2 swap. Two new product goals force that swap
now:

- **"Different models as drop-in replacements."** The claude.ai Routine *is*
  Claude Code — structurally Anthropic-only. It cannot point at GPT, Gemini, or
  a local model, and cannot accept a customer's API key.
- **Two commercial lines** — an easy/expensive managed offering and a
  self-configured BYOK offering — both of which need the teacher to run as
  operated, parameterised compute rather than a UI-provisioned subscription
  agent.

The buried cost is that the teacher is an **agent loop**, not a single model
call (claim → materialise → author interactive HTML → publish), tuned to
Claude's harness and artifact quality. "Any vendor" therefore splits into two
very different promises: making a model **reachable** (cheap, via a gateway) vs.
making a model **good** at this task (expensive, per-vendor prompt tuning + a
quality eval harness).

## Decision

- **Port the teach loop off Claude Code** onto a programmatic agent runtime
  (Anthropic Agent SDK or equivalent) that takes the model + endpoint + key as
  configuration. The Convex orchestration seam — gate, lock, claim, fire, report
  ([ADR 0009](0009-content-source-of-truth-in-convex-routine-pulls-context.md))
  — is unchanged. [ADR 0001](0001-asynchronous-hub-mediated-teaching-loop.md)
  still holds: no LLM runs in the web app.
- **Front the runtime with an OpenAI-compatible gateway** (e.g. LiteLLM /
  OpenRouter) so "add a vendor" is a model string + a key field, not a bespoke
  integration.
- **Managed line** — operator-run compute on **Claude**, prompt-tuned and
  quality-guaranteed, metered and billed to the customer. Zero configuration for
  the customer. The "easy and expensive" line.
- **BYOK line** — the customer supplies any OpenAI-compatible key + model and
  configures it themselves; they pay their vendor directly. **Quality is
  guaranteed on Claude only**; every other model is *reachable* but quality is
  the customer's responsibility. The "configure it yourself" line.
- **Model tier is an orthogonal knob** on both lines (Opus / Sonnet / Haiku, or
  the BYOK customer's chosen model) — the genuine "drop-in" axis.

## Considered options

- **Keep the claude.ai Routine forever** (rejected): Anthropic-only and
  UI-provisioned; cannot do BYOK or other vendors, cannot meter per customer.
- **Guarantee lesson quality on every vendor at launch** (rejected): months of
  per-vendor prompt tuning plus an eval harness, with ongoing maintenance ×N
  vendors; threatens the company-demo timeline for little near-term gain.
- **Bespoke per-vendor SDK integrations** (rejected): a gateway buys vendor
  reach for roughly free; hand-writing each vendor's client is cost with no
  upside over the gateway.
- **Direct Messages-API custom harness with no gateway** (rejected): same
  re-implementation cost as the gateway path but without multi-vendor reach.

## Consequences

- **The largest engineering item is the port itself** — re-expressing the
  file-based teach skill (ZPD, references, learning records, Resource grounding,
  HTML artifact authoring) as a programmatic agent loop. Both lines depend on
  it; it is the spine, not a feature.
- **Per-customer secrets now exist.** The BYOK line stores customer API
  keys/endpoints, which must be encrypted at rest, never logged, and scoped to
  the owner. Convex env vars are deployment-wide, not per-user — a per-owner
  secret store (or a thin keys-service) is required. This is a new security
  surface that did not exist while the operator funded everything.
- **Metering/billing becomes necessary** for the Managed line (token/usage
  accounting per customer), where Phase 1 had none.
- **Product copy and the BYOK config UX must set the quality expectation** — "we
  guarantee Claude; other models are reachable but their quality is on you" —
  or non-Claude output will read as a product defect.
- **Quality drift is now possible** on the Managed line too, if the operator
  swaps the default Claude tier for cost reasons; the guarantee is tied to a
  named tier, not "Claude" in the abstract.
