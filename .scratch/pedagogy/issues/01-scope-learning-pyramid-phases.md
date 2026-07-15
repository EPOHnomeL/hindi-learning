# pedagogy/01: Scope learning-pyramid phases

**Status:** open
**Depends on:** — (reconcile with course-modules/01)

## Why

"Have a phase for every learning pyramid step" — the ambition that a concept isn't taught by
read-and-quiz alone but passes through the pyramid's modalities: read/lecture → audio-visual
→ demonstration → discussion → practice → teach others. Several steps are being built
elsewhere (rich-media = audio-visual, ai-chat/03 = discussion, pedagogy/02 = practice/teach-
back); this ticket scopes the **organising frame** that ties them together. Deliberately
undecided (2026-07-15): whether phases are *structural* or *policy*.

## Questions to answer

- **Structural vs policy** — the central question:
  - *Structural*: the platform tracks phases per concept/module — schema (phase state per
    concept), reader UI ("you're in the discussion phase of Module 2"), a richer
    [[Frontier]]. Interacts hard with course-modules/01 (modules + per-module unlocking) —
    are phases *within* modules?
  - *Policy*: the teach skill must author across all modalities (SKILL.md rules + an
    authoring checklist); the platform stays as-is. Ponytail-cheap, ships first.
  - A middle road: policy now, structure when modules land?
- Honest note on the evidence: the "learning pyramid" retention percentages are pop-science —
  which steps do we actually believe in (retrieval practice, spacing, and interleaving are
  the evidence-backed teach-skill principles)? Frame the feature on the *modalities*, not the
  debunked numbers.
- Mapping table: pyramid step → owning component (existing ticket or gap). "Demonstration"
  and "teach others" have no owner today — do they need tickets or fold into 02?
- Does [[Progress]]/[[Completion]] change meaning if a concept has phases (complete = all
  phases done)?
- Naming: **Phase** as a CONTEXT.md term (vs the retired "module"? vs "step").

## Out of scope

- Building any phase machinery; the discussion/audio/practice features themselves.

## Deliverable

The structural-vs-policy decision (or the staged middle road), the step→component mapping
table with gaps named, and the reconciliation with course-modules/01.
