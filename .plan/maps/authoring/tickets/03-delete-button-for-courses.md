---
type: grilling
blocked_by: []
---

# Delete button for courses

## Question

Originally imported with no body (GitHub #33, 2026-07-10). Fleshing out from the actual
need behind it.

## Why

The operator has accumulated many courses across users/tenants and needs to **clean them
up** — remove ones that shouldn't exist anymore (test courses, abandoned generations,
duplicates) rather than leaving them to accumulate forever. Today there's no delete path for
a Topic at all.

## Open questions for triage

- **What "delete" means**: Topics/Lessons are treated as durable content elsewhere in the
  app (immutable Lessons, ADR 0003) — is course delete a hard delete (row + storage blobs
  gone) or a soft-delete/archive (hidden from lists, recoverable)? Given this is explicitly
  for *cleanup*, hard delete is probably the actual want, but that's a real decision, not an
  assumption.
- **What it cascades to**: Editions, Entitlements/purchases, Certificates already issued,
  Progress/Completion records, shared/public links pointing at it. A paid course with live
  buyers can't just vanish — does delete require zero entitlements first (mirrors the
  tenant-removal hard-block pattern in whitelabel/06), or does it force-revoke access?
- **Who can delete**: owner only, sys-admin only, or tenant-admin for their own tenant's
  courses too?
- **Storage cleanup**: does deleting a Topic also reclaim its Lesson/Reference content blobs
  (`_storage`), or leave them orphaned (cheap to ignore, or a real cost concern at scale)?

## Relates to

- The new course-folders/organization ask (separate issue) — bulk cleanup and organization
  are the same underlying need (many courses, one operator, needs structure + a way to prune).
- `whitelabel/06`'s tenant-removal hard-block pattern (refuse to remove while references
  exist) is the closest existing precedent for the cascade-safety question above.

## Next step

Run `/grilling` + a PRD pass under `.plan/maps/course-delete/` once picked up — the
hard-vs-soft-delete and cascade questions need resolving before any acceptance criteria are
written.

## Done when

The hard-vs-soft-delete decision, the cascade rule for Entitlements / Certificates / Progress / public links, the who-can-delete answer, and the storage-cleanup call are all written down.

<!-- Migrated 2026-07-30 from GitHub issue #61 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `course-delete` map (2026-08-01)

<!-- was .plan/maps/authoring/tickets/03-delete-button-for-courses.md; that single-ticket map was consolidated into course-management -->

- The motivation is **cleanup at scale**: test courses, abandoned generations, duplicates
  accumulating across users and tenants. That pushes toward hard delete, but it's a decision,
  not an assumption — ADR 0003 treats content as durable.
- **The cascade is the dangerous part.** Editions, Entitlements/purchases, issued
  Certificates, Progress/Completion, and public links all point at a Topic. A paid course
  with live buyers cannot just vanish.
- **Closest precedent in the repo:** whitelabel/06's tenant-removal hard-block — refuse the
  removal while references exist, rather than force-revoking. Start there.
- **Grill this together with** [Folders and collections](02-folders-and-collections.md) —
  same root need (too many courses, one operator: prune *and* structure). Also note
  [Share management](../../distribution/tickets/06-share-management.md) parks its
  share-cascade work on a topic-delete mutation existing at all.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`.
- **Fog:** bulk delete — the stated need is cleaning up *many* courses; one-at-a-time may not
  answer it. Sharpens once the single-course semantics are fixed.
- **Out of scope:** deleting individual Lessons — `deleteLesson` already exists.

<!-- Moved 2026-09-01 from `course-management/01` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. -->
