---
type: task
blocked_by: []
---

# Disambiguate the three "engine"/"provider" axes

## Question

Three independent selection axes share the words "engine"/"provider," each with its own
"absent reads as X" fallback repeated near-verbatim in multiple places:

- `convex/translate.ts` job `engine: "free" | "gemini"` — per-Edition translation choice
  (`translate.ts:33, 202-204`).
- `translateProvider(): "gemini" | "openrouter"` — deployment-wide env config
  (`translate.ts:622-626`).
- `convex/routine.ts` `topic.provider: "claude" | "openrouter"` — per-course authoring choice
  (`routine.ts:303, 373, 638-642, 940`).

A reader has to hold three unrelated meanings of the same noun in their head at once, and the
fallback comment ("absent reads as X") is restated at each read site instead of centralized
(`translate.ts:202, 620-623, 804, 860`; `routine.ts:373, 940`).

Scope: rename each axis distinctly — `translate.ts` job field → `translationEngine` (per-Edition);
`translateProvider()` → `translationBackend()` (deployment-wide env); `routine.ts` `topic.provider`
→ `authoringProvider` (per-course, a schema field rename — check whether it needs a migration or
can ride as an additive alias). Centralize each axis's "absent reads as X" fallback in one place
(the accessor). Behavior-preserving rename only.

Also flagged in passing: `routine.ts:373`/`:940` cite ADR-0014
(`docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md`, still "proposed") as the
rationale for the already-shipped `provider: topic.provider ?? "claude"` field, but the ADR's real
scope (BYOK line, Agent-SDK port, per-customer metering) is far larger than what's cited against
it. This is a documentation follow-up (narrow the citation or split the ADR) — surface it to the
user, do not resolve it here without sign-off.

## Done when

Three distinct names in code with no shared noun across the three axes, each axis's fallback rule
stated once in its accessor (not restated at every read site), `pnpm typecheck` clean and the full
convex suite green — deciding along the way whether the `topic.provider` rename needs a real schema
migration or can ride as an additive alias.

## Answer

**Landed** on `main` (`0f685b6`). The three axes are now named distinctly: `engine` (per-Edition) /
`translationBackend()` (per-deployment) / `authoringProvider()` (per-course), each fallback stated
once in its accessor. **No migration was needed:** both persisted columns and `TRANSLATE_PROVIDER`
keep their names — only the code vocabulary moved, which is what the "additive alias" question was
really asking.

The ADR-0014 citation/scope mismatch was flagged and left untouched, awaiting the user's call
(narrow the citation, or split the ADR) — carried to the map's Follow-ups.
