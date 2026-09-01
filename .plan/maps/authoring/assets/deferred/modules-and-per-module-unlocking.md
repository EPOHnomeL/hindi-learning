<!-- NOT A TICKET. Deferred 2026-09-01 in the .plan consolidation: this was a ticket on a map
     that no longer exists, and its subject is now a fog patch under "## Not yet specified" on the
     authoring map. Kept verbatim (frontmatter stripped) so re-cutting it as a ticket costs nothing but a
     `git mv` back into tickets/ and a number. Nothing here is a commitment. -->


# Course modules + per-module unlocking

## Question

**Where it stands:** needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../../../CONTEXT.md) (Topic, Lesson, Frontier, Edition, Entitlement, Completion). ⚠️ **Vocabulary tension:** the glossary today explicitly lists **"module"** under Lesson's _Avoid_. Relates to [ADR 0003](../../../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons), [ADR 0016](../../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace / per-Edition Entitlement), and the course-completion feature.

## Want

Group a Topic's Lessons into **Modules** — named, ordered sections — and support **per-module unlocking**: a learner unlocks (and potentially pays for) individual modules rather than the whole course at once. Today a course is a single flat, linear sequence of Lessons and access is all-or-nothing (ownership, Share, Public link, or — on the paid branch — a per-Edition Entitlement).

## Acceptance (to refine at triage)

- A Topic's Lessons can be organised into **ordered Modules** (a module = a titled group of Lessons).
- The reader + dashboard show module structure and **per-module progress** (not just the course-wide count).
- **Per-module unlocking**: access can be granted at the module grain (a module is free or locked independently), extending today's all-or-nothing / per-Edition access to a finer grain.
- The **Routine's** authoring still works with modules — decide how module boundaries interact with the single linear **Frontier** (buffer-of-one) gate.
- Lessons stay **immutable** (ADR 0003): reorganising into modules is a grouping/ordering concern, not a rewrite.

## Open decisions

- **Vocabulary.** `CONTEXT.md` deliberately avoids "module". Introducing it needs a glossary term (and likely an ADR), or a different name — resolve at triage / with the domain-modeling skill.
- **Monetisation grain.** Is a **Module** the new purchasable unit, or does it sit *under* an **Edition** (e.g. buy a specific module within a paid Edition)? This is the crux of "per-module unlocking" and depends on the paid-marketplace shape ([ADR 0016](../../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)).
- **Editions × Modules.** How modules compose with per-language Editions and per-Edition Entitlements.

## Depends on

- A domain/ADR decision on the **"Module"** term (glossary conflict above).
- If modules become purchasable: the paid marketplace ([ADR 0016](../../../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md), `feat/paid-marketplace`).

## Notes

- To-scope only; not built.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no `modules` table; `lessons` is a flat `seq` per topic (schema.ts:78-91); access and progress are all-or-nothing with no module grouping anywhere in schema, queries, or UI.

## Done when

The module grain, its interaction with the Frontier buffer-of-one, the per-module access model, and the CONTEXT.md vocabulary tension ("module" is currently under Lesson's *Avoid*) are all resolved.

<!-- Migrated 2026-07-30 from GitHub issue #64 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `course-modules` map (2026-08-01)

<!-- was .plan/maps/authoring/assets/deferred/modules-and-per-module-unlocking.md; that single-ticket map was consolidated into course-management -->

- **Vocabulary tension, flagged at filing:** CONTEXT.md currently lists *"module"* under
  Lesson's **Avoid**. This ticket either overturns that entry or picks a different term — it
  cannot quietly ignore it. Run `/domain-modeling`.
- Today a course is one flat linear Lesson sequence and access is all-or-nothing (ownership,
  Share, Public link, or a per-Edition Entitlement).
- **The Frontier is the hard part:** the Routine authors a buffer of one against a single
  linear frontier. Module boundaries either respect that gate or change it.
- Access at module grain interacts with ADR 0016's per-Edition Entitlement — a finer grain is
  a marketplace change, not just a UI grouping.
- **Reconcile with**
  [Scope learning-pyramid phases](../../../learning-experience/assets/deferred/learning-pyramid-phases.md):
  if phases are structural, "are phases within modules?" is the same question from the other
  side. That ticket names this reconciliation as part of its deliverable.
- ADR 0003 still holds: regrouping is ordering, never a rewrite.
- **Out of scope:** folders/collections *over* courses — a different grain entirely
  ([Folders and collections](02-folders-and-collections.md)).
