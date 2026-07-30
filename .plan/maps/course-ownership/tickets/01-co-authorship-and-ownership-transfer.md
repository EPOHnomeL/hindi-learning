---
type: grilling
blocked_by: []
---

# Course co-authorship / ownership transfer (topics.ownerId is single-owner only)

## Question

Deferred feature idea, not yet grilled or PRD'd. No local `.scratch` file yet — first
capture is this issue. Surfaced while scoping [course-authoring/03](../../course-authoring/tickets/03-self-serve-course-building.md)/#105 (self-serve building + course
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
