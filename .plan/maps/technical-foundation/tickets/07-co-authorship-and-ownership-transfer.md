---
type: grilling
blocked_by: []
---

# Course co-authorship / ownership transfer (topics.ownerId is single-owner only)

## Question

Deferred feature idea, not yet grilled or PRD'd. No local `.scratch` file yet — first
capture is this issue. Surfaced while scoping [Self-serve course building](../../authoring/assets/deferred/self-serve-course-building.md)/#105 (self-serve building + course
organization) — this is the data-model gap underneath both.

## The gap

`convex/schema.ts:109` — `topics.ownerId` is a single `v.optional(v.id("users"))`. There is
no concept of a second owner, a collaborator, or a transfer-of-ownership action anywhere in
the schema or mutations. Today exactly one user can own/build a given course, permanently
(barring a direct DB edit).

This is the concrete primitive missing underneath:
- **#104** (self-serve course building, "hand over building capabilities to other people") —
  delegating building assumes *someone else can become an owner/co-owner* of a course.
- **#105** (organize courses into folders) — cleanup at scale often means "this course really
  belongs to so-and-so now," not just "group it visually."

## Open questions for triage

- **Transfer vs. co-ownership**: does a course get handed to exactly one new owner (simple
  transfer), or can multiple people jointly own/build one course (real multi-author)? These
  are very different builds — transfer is a single mutation; co-ownership touches every
  ownership check in the codebase (`getOwnedTopic` and siblings).
- **Whitelabel interaction**: tenant-admins already have scoped admin rights over their
  tenant's courses (whitelabel two-tier admin, ADR 0022) — is transferring ownership *within*
  a tenant different from transferring *across* tenants (e.g., a course built on the default
  site handed to a tenant-scoped builder)?
- **What happens to existing state on transfer**: Progress/Completion/Entitlements/
  Certificates already issued to learners — does the course's identity (slug, purchases,
  learner access) survive a transfer untouched, or does anything need re-keying?
- **Audit trail**: given multiple people can now build/own/delete courses, is there any
  record of who did what? (Today: none — no activity log exists.) Worth deciding whether
  that's in scope here or its own separate concern.

## Next step

Run `/grilling` + a PRD pass once picked up — the transfer-vs-co-ownership question is the
fork everything else depends on.

## Done when

The transfer-vs-co-ownership fork is closed, with the whitelabel interaction, the fate of existing learner state on transfer, and the audit-trail question all answered.

<!-- Migrated 2026-07-30 from GitHub issue #106 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `course-ownership` map (2026-08-01)

<!-- was .plan/maps/course-management/tickets/03-co-authorship-and-ownership-transfer.md; that single-ticket map was consolidated into course-management -->

- **The gap is concrete:** `convex/schema.ts` has `topics.ownerId` as a single optional user
  id. No second owner, no collaborator, no transfer action exists anywhere in the schema or
  mutations. Exactly one user owns a course, permanently.
- **The fork is the whole question.** Transfer is one mutation. Co-ownership touches *every*
  ownership check in the codebase (`getOwnedTopic` and siblings). Decide before building.
- This is the primitive underneath
  [Self-serve course building](../../authoring/assets/deferred/self-serve-course-building.md)
  ("hand over building capabilities") and part of
  [Folders and collections](../../authoring/assets/deferred/folders-and-collections.md) ("this course really belongs to
  so-and-so now").
- Whitelabel's two-tier admin model (ADR 0022) already gives tenant-admins scoped rights —
  so transferring *within* a tenant may differ from transferring *across* tenants.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `convex:convex-authz`
  (co-ownership is an authorization change, and that is where the real defects live).
- **Fog:** an activity/audit log. None exists today. Once several people can build, own, and
  delete courses, "who did what" becomes a real question — raised here without deciding
  whether it belongs to this effort.
- **Out of scope:** learner-side access grants (Share, Entitlement) — a different relation.

<!-- Moved 2026-09-01 from `course-management/03` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 07 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
