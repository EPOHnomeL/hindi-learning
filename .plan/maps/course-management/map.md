# Course management

<!-- Charted 2026-08-01 by consolidating four single-ticket maps — course-delete,
     course-organization, course-ownership and course-modules — that were each a
     lone issue wearing a map's clothes. Each ticket carries the context its old
     map held, folded in under a "Context folded from" heading. This map is an
     INDEX, not a store — each decision lives in its own ticket. -->

## Destination

A settled model for **an operator with too many courses**: how a course is pruned, grouped,
handed to someone else, and internally structured — four decisions that share one root need
and keep colliding when they are decided apart.

## Notes

- **Domain:** Topic, Lesson, Edition, Entitlement, Certificate, Frontier (CONTEXT.md).
- **Why these four are one map.** The original ask was a single operator complaint — *too many
  courses, one person, no way to manage them*. It was filed as four separate issues, and each
  became a one-ticket map. They are not independent: pruning needs the cascade story
  ([01](tickets/01-delete-button-for-courses.md)), grouping must not duplicate tenant scoping
  ([02](tickets/02-folders-and-collections.md)), delegation needs a second owner to exist
  ([03](../technical-foundation/tickets/07-co-authorship-and-ownership-transfer.md)), and grouping *within* a course
  is the same shape one grain down ([04](tickets/04-modules-and-per-module-unlocking.md)).
- **Grill 01 and 02 together** — same root motivation, and separating pruning from structure
  is the first thing the grilling has to do.
- **03 is a primitive, not a feature.** `topics.ownerId` is a single optional user id; nothing
  else in the schema admits a second owner. Both
  [Self-serve course building](../course-authoring/tickets/03-self-serve-course-building.md)
  and ticket 02's "this really belongs to so-and-so now" sit on top of it.
- **The recurring constraint across all four is ADR 0003** (Lessons immutable, content
  durable) and ADR 0016 (per-Edition Entitlement). Any answer that mutates or vanishes paid
  content has gone wrong.
- **Check whitelabel first, twice.** The tenant model (ADR 0022) may already supply coarse
  grouping *and* scoped admin rights — both 02 and 03 can be smaller than they look.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `convex:convex-authz`
  (03 is an authorization change), `/ponytail`.

- **Moved out 2026-09-01 to the [technical-foundation map](../technical-foundation/map.md)**, which now groups this repo’s scalability, refactoring and code-architecture work:
  - `course-management/03` [Course co-authorship / ownership transfer](../technical-foundation/tickets/07-co-authorship-and-ownership-transfer.md), now **07** there.
  
    It is the data-model gap (`topics.ownerId` is single-owner) underneath both this map’s folders ticket and `course-authoring/03`, so it is a schema decision rather than a course-management feature.
  
    Renumbering was forced: `blocked_by` is map-local, and the numbers collided across the twelve donor maps. **Do not reuse the old numbers here**, they remain those tickets’ identity in this map’s history.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Bulk delete** — the stated need is cleaning up *many* courses; one-at-a-time may not
  answer it. Sharpens once 01 fixes the single-course semantics.
- **An activity/audit log.** None exists today. Once several people can build, own and delete
  courses, "who did what" becomes real. Raised by 03 without deciding whether it lands here.
- **Whether tenant-admins get grouping too.** Depends on how far the two-tier admin model
  already reaches; sharpens once 02's admin-only-or-not question is answered.

## Out of scope

- Deleting individual Lessons — `deleteLesson` already exists.
- Learner-side access grants (Share, Entitlement) — a different relation entirely, owned by
  [topic-sharing](../topic-sharing/map.md).
- The authoring acts themselves — [course-authoring](../course-authoring/map.md).
