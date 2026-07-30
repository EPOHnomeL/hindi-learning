# Course delete

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A settled answer to what deleting a course *means* here — hard or soft, what it cascades to,
who may do it — concrete enough to write acceptance criteria against. There is no delete path
for a Topic at all today.

## Notes

- The motivation is **cleanup at scale**: test courses, abandoned generations, duplicates
  accumulating across users and tenants. That pushes toward hard delete, but it's a decision,
  not an assumption — ADR 0003 treats content as durable.
- **The cascade is the dangerous part.** Editions, Entitlements/purchases, issued
  Certificates, Progress/Completion, and public links all point at a Topic. A paid course
  with live buyers cannot just vanish.
- **Closest precedent in the repo:** whitelabel/06's tenant-removal hard-block — refuse the
  removal while references exist, rather than force-revoking. Start there.
- **Grill this together with**
  [course-organization/01](../course-organization/tickets/01-folders-and-collections.md) —
  same root need (too many courses, one operator: prune *and* structure). Also note
  [topic-sharing/06](../topic-sharing/tickets/06-share-management.md) parks its share-cascade
  work on a topic-delete mutation existing at all.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Bulk delete.** The stated need is cleaning up *many* courses; one-at-a-time may not
  answer it. Sharpens once the single-course semantics are fixed.

## Out of scope

- Deleting individual Lessons — `deleteLesson` already exists.
