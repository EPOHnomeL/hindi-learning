---
type: grilling
blocked_by: []
---

# Self-serve course building: user-driven AI-generate + translate + sell, not just edit

## Question

Deferred feature idea, not yet grilled or PRD'd. No local `.scratch` file yet — first
capture is this issue.

## The ask

User's framing: *"allowing a user to not just edit but also build (i.e. AI generate and
Translate and sell) a course — so that ability to do that."*

Distinct from the existing `course-authoring` scope ([AI-assisted course editing](01-ai-assisted-course-editing.md)/#60), which is about **revising an
already-seeded course** (edit-intents against existing content). This is about the **front
door**: can an ordinary user (not just an operator/admin) go through a self-serve flow that:

1. **Generates** a new course from scratch (today's "Seed a Topic" flow — title + "why" +
   Resources → Routine authors autonomously — is this already open to any user, or
   admin/operator-gated? Needs checking against the current Allowlist/course-creation model.)
2. **Translates** it into one or more languages (the Edition machinery already exists —
   does a builder get a translate step in the same flow, or is it a separate later action?)
3. **Sells** it (paid-marketplace + PayFast checkout already exist for *listing* a course —
   does "build" flow straight into seller onboarding/pricing, or is that a deliberately
   separate step?)

## Why this needs scoping, not just building

- Today's course creation ("seed-and-go") assumes a trusted author. Opening it to any user
  raises the same cost/abuse questions as `paid-marketplace/01` ([Authoring-cost funding & model-provider strategy](../../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md), authoring-cost funding
  & model-provider strategy) — a self-serve generate button is a metered LLM cost per click.
- Overlaps but is not identical to `course-authoring` ([AI-assisted course editing](01-ai-assisted-course-editing.md)) — that's post-seed editing;
  this is pre-seed, the build flow itself.
- Whitelabel/tenant implications: does a self-serve builder create a course scoped to their
  own tenant, the default site, or is tenant assignment part of the flow?

## Open questions for the grilling / PRD stage

- Who can build: any signed-in user, or still Allowlist/tenant-admin gated?
- Cost/metering for the generate step — ties into `paid-marketplace/01` ([Authoring-cost funding & model-provider strategy](../../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md)).
- Does "translate" happen at build time (bundled) or as a later, separate Edition action?
- Does "sell" require seller payout details up front (payfast-payments precedent) or can a
  course be built and published free first, monetized later?
- Relationship to `course-authoring` ([AI-assisted course editing](01-ai-assisted-course-editing.md)/#60) — same UI surface extended earlier in the
  lifecycle, or a genuinely separate flow?

## Next step

Run `/grilling` + a PRD pass, likely under a new `.plan/maps/course-building/` directory, once
picked up.

## Done when

The who-can-build gate, the metering answer, the translate-and-sell sequencing, and the relationship to tickets 01/02 are all decided, with a spec.

<!-- Migrated 2026-07-30 from GitHub issue #104 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
