# Course ownership

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The **transfer-vs-co-ownership fork closed** — the data-model primitive missing under both
self-serve building and course organization — with the fate of existing learner state on a
transfer decided.

## Notes

- **The gap is concrete:** `convex/schema.ts` has `topics.ownerId` as a single optional user
  id. No second owner, no collaborator, no transfer action exists anywhere in the schema or
  mutations. Exactly one user owns a course, permanently.
- **The fork is the whole map.** Transfer is one mutation. Co-ownership touches *every*
  ownership check in the codebase (`getOwnedTopic` and siblings). Decide before building.
- This is the primitive underneath
  [course-authoring/03](../course-authoring/tickets/03-self-serve-course-building.md)
  ("hand over building capabilities") and part of
  [course-organization/01](../course-organization/tickets/01-folders-and-collections.md)
  ("this course really belongs to so-and-so now").
- Whitelabel's two-tier admin model (ADR 0022) already gives tenant-admins scoped rights —
  so transferring *within* a tenant may differ from transferring *across* tenants.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `convex:convex-authz`
  (co-ownership is an authorization change, and that is where the real defects live).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **An activity/audit log.** None exists today. Once several people can build, own, and
  delete courses, "who did what" becomes a real question — ticket 01 raises it without
  deciding whether it belongs here.

## Out of scope

- Learner-side access grants (Share, Entitlement) — a different relation entirely.
