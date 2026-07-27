# architecture-deepening/05: Disambiguate the three "engine"/"provider" axes

**Status:** open
**Labels:** ready-for-agent

## Why

Three independent selection axes share the words "engine"/"provider," each with its own
"absent reads as X" fallback repeated near-verbatim in multiple places:

- `convex/translate.ts` job `engine: "free" | "gemini"` — per-Edition translation choice
  (`translate.ts:33, 202-204`).
- `translateProvider(): "gemini" | "openrouter"` — deployment-wide env config
  (`translate.ts:622-626`).
- `convex/routine.ts` `topic.provider: "claude" | "openrouter"` — per-course authoring choice
  (`routine.ts:303, 373, 638-642, 940`).

A reader has to hold three unrelated meanings of the same noun in their head at once. The
fallback comment ("absent reads as X") is restated at each read site instead of centralized
(`translate.ts:202, 620-623, 804, 860`; `routine.ts:373, 940`).

Also noted in passing: `routine.ts:373` and `:940` cite ADR-0014
(`docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md`, still marked "proposed") as the
rationale for the already-shipped `provider: topic.provider ?? "claude"` field. The ADR's actual
scope (BYOK line, Agent-SDK port, per-customer metering) is far larger than what's cited against
it — worth a documentation fix (narrow the citation or split the ADR), separate from the code
rename below. Flag to the user before touching the ADR — it's a documentation decision, not a
pure refactor.

## Scope

- Rename each axis distinctly, e.g.:
  - `translate.ts` job field → `translationEngine` (per-Edition).
  - `translateProvider()` → `translationBackend()` (deployment-wide env).
  - `routine.ts` `topic.provider` → `authoringProvider` (per-course) — note this is a schema field
    rename, so check whether it needs a migration step or can ride as an additive alias.
- Centralize each axis's "absent reads as X" fallback in one place (the accessor function) instead
  of restating it at every call site.

## Out of scope

- Changing what any axis actually selects (behavior-preserving rename only).
- The ADR-0014 citation/scope mismatch — surface it to the user as a documentation follow-up, do
  not resolve it as part of this ticket without their sign-off.

## Acceptance criteria

- [ ] Three distinct names in code, no shared noun across the three axes.
- [ ] Each axis's fallback rule stated once (in the accessor), not restated at every read site.
- [ ] `pnpm typecheck` clean, full convex suite green.

## Notes

If `topic.provider` needs a real schema rename (not just a TS-level alias), this ticket may need
`convex:convex-expert` + a look at `convex-migration-helper` guidance before touching the schema —
check whether a additive-field approach avoids a migration entirely.

Independent of tickets 01/02/03/04.

## Comments
