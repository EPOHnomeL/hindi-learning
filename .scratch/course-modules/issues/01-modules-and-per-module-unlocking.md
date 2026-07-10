# 01 — Course modules + per-module unlocking

Status: needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Frontier, Edition, Entitlement, Completion). ⚠️ **Vocabulary tension:** the glossary today explicitly lists **"module"** under Lesson's _Avoid_. Relates to [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons), [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md) (paid marketplace / per-Edition Entitlement), and the course-completion feature.

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
- **Monetisation grain.** Is a **Module** the new purchasable unit, or does it sit *under* an **Edition** (e.g. buy a specific module within a paid Edition)? This is the crux of "per-module unlocking" and depends on the paid-marketplace shape ([ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md)).
- **Editions × Modules.** How modules compose with per-language Editions and per-Edition Entitlements.

## Depends on

- A domain/ADR decision on the **"Module"** term (glossary conflict above).
- If modules become purchasable: the paid marketplace ([ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md), `feat/paid-marketplace`).

## Notes

- To-scope only; not built.

## Comments

- 2026-07-10 — Migrated to GitHub issue [#18](https://github.com/EPOHnomeL/hindi-learning/issues/18); GitHub is now the tracking home for this ticket.
