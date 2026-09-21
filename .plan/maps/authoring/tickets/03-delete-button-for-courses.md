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

## Answer

**Decided and built 2026-09-21**, in one session, because every open question here
turned out to be answerable by one principle rather than by four separate calls.

**Hard delete, not an archive.** The need this ticket records is cleanup at scale:
test courses, abandoned generations, duplicates. A soft-delete flag would have left
every row and every content blob exactly where it was, which is the opposite of the
ask. ADR 0003's immutability governs a *published Lesson inside a live course*; it
has never said a course the owner wants gone must be kept forever.

**The cascade is guarded by refusal, not by force.** `courseHolders` (in
`convex/content/authoring.ts`) counts, over indexed reads, everything that would be
taken from somebody other than the owner: buyers (`entitlements`), issued
`certificates`, people it is shared with (`shares`), learners who joined
(`enrollments`), a live `listings` row, and the org rails that mean money moved
(`voucherBatches`, `accessCodes`, `eftIntents`). Any one of them non-zero and the
delete is refused with the reasons named, mirroring `tenants.removeTenant`'s
refuse-to-remove pattern, which the ticket already pointed at as the precedent. The
counts are exposed to Course settings as `courseDeleteHolders` so the owner reads
*why* on the page rather than in an error, but the server re-derives them and is the
real boundary. Three `by_topic` indexes were added (`accessCodes`, `voucherBatches`,
`eftIntents`) so the guard is exact and never a table scan.

**Deliberately NOT blockers:** a Public link and an unaccepted e-mail invitation.
Neither names a person holding the course today, both are already the owner's to
revoke at will, so the delete revokes them.

**Deliberately NOT deleted:** `generationRuns` and everything on the money rails
(`ledger`, `payfastEvents`, `checkoutIntents`). `routine.runHistory` already renders
a run whose Topic is gone as "(deleted course)", and `sales.ts` already falls back
when a Ledger row's Topic will not resolve, so both logs were built to outlive a
course. Deleting a course must not erase the record of what it cost or what it
earned.

**Who:** the owner, from the bottom of Course settings (`getOwnedTopic`, so an
Editor may rewrite prose but never destroy the course). Not sys-admin-only: the
operator cleaning up is the owner of the test courses in question.

**Storage is reclaimed.** Lesson, Reference, Resource, translation and narration
blobs, plus the Emblem image, go with their rows. A blob whose row is gone is a cost
with no way back to it. The Emblem is only safe to drop because the guard has
already established there are no Certificates, and a Certificate freezes its own
copy.

**One transaction, deliberately.** A Convex mutation is atomic, so a course too
large to delete in one go throws and deletes nothing, which is the only safe way for
this to fail. A course big enough to hit that ceiling needs a paged action; that can
be built the day a real course hits it.

Code: `deleteTopic` + `courseDeleteHolders` in `convex/content/authoring.ts`,
`DeleteSection` in `src/app/_components/CourseSettings.tsx` (type-the-title to
confirm, since unlike every other confirm in that file this one cannot be undone),
tests in `convex/course-delete.test.ts`.

**Still fog, and still unticketed: bulk delete.** The stated need was cleaning up
*many* courses and this answers one at a time. That fog is unchanged, and sharpens
now that single-course semantics are fixed. It stays on the map under
[Folders and collections](../assets/deferred/folders-and-collections.md), which is
the same root need.

**Unblocked by this:** [distribution/06](../../distribution/tickets/06-share-management.md),
whose share-cascade half was waiting on a topic-delete mutation existing at all. Note
that the shape it gets is a *refusal* on outstanding shares rather than a cascade over
them, so 06 should be re-read against that before it is built.

<!-- Moved 2026-09-01 from `course-management/01` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. -->
