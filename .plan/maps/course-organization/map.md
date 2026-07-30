# Course organization

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on what structure the course list gains — real folders, flat tags, or nothing
beyond the tenant grouping that may already exist — so an operator with too many courses can
manage them.

## Notes

- The ask tangles three things; **separate them before grilling**: grouping structure,
  cleanup/pruning, and delegating building to other people.
- Two of the three already have owners:
  [course-delete/01](../course-delete/tickets/01-delete-button-for-courses.md) (pruning) and
  [course-authoring/03](../course-authoring/tickets/03-self-serve-course-building.md) plus
  [course-ownership/01](../course-ownership/tickets/01-co-authorship-and-ownership-transfer.md)
  (delegation). This map owns **only the grouping**.
- **Check before inventing:** whitelabel's tenant model may already give a coarse grouping
  for free. A new folder concept that duplicates tenant scoping is the failure mode here.
- Prior art check done at filing: no existing folder/collection ticket. `course-modules/01`
  groups *Lessons within one course* — a different concept, not this.
- **Grill together with course-delete/01** — shared motivation.
- Skills: `/grilling` + `/domain-modeling`, `/ponytail` (flat tags may be the whole answer).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether tenant-admins get this too.** Depends on how far whitelabel's two-tier admin
  model already reaches; sharpens once the admin-only-or-not question is answered.

## Out of scope

- Grouping Lessons inside a course ([course-modules](../course-modules/map.md)).
- Deleting courses ([course-delete](../course-delete/map.md)).
