<!-- NOT A TICKET. Deferred 2026-09-01 in the .plan consolidation: this was a ticket on a map
     that no longer exists, and its subject is now a fog patch under "## Not yet specified" on the
     authoring map. Kept verbatim (frontmatter stripped) so re-cutting it as a ticket costs nothing but a
     `git mv` back into tickets/ and a number. Nothing here is a commitment. -->


# Organize courses into folders/collections (admin course-list management at scale)

## Question

Deferred feature idea, not yet grilled or PRD'd. No local `.scratch` file yet — first
capture is this issue. Checked for prior art: no existing folder/collection/organize ticket
found in `.scratch` (course-modules/01 is about grouping *Lessons within one course*, a
different concept — not this).

## The ask

User's framing: *"make folders or organize them ... because I need to clean up all my
courses and hand over building capabilities to other people and organize them."*

The operator has accumulated enough courses (across users and tenants) that the flat course
list is no longer manageable. Three things tangled together in the ask, worth separating at
triage:

1. **Folders/collections** — some grouping structure over Topics in the admin view, beyond
   today's flat list (and beyond the existing tenant-scoped filtering from whitelabel).
2. **Cleanup** — the companion need is deleting what shouldn't exist anymore (tracked
   separately as [Delete button for courses](01-delete-button-for-courses.md), course-delete) — organizing and pruning are the same underlying
   problem (too many courses, one operator).
3. **Delegating building to other people** — "hand over building capabilities" is the same
   question already open in [Self-serve course building](../../../authoring/assets/deferred/self-serve-course-building.md) (self-serve course building) — who else gets to create/own
   courses, and does *that* imply folder/collection ownership too (my folder vs. shared vs.
   tenant-wide)?

## Open questions for triage

- Is this admin/operator tooling only (an `/admin` course-list feature), or does it extend to
  how tenant-admins see their own tenant's courses (whitelabel's two-tier admin model)?
- Folder as a real hierarchy (nested) vs. flat tags/labels vs. simple per-tenant grouping
  that whitelabel's tenant model may already give for free?
- Does a course belong to exactly one folder, or many (tags)?
- Ownership/permissions: who can create a folder, move a course into one, or see another
  author's folder?

## Relates to

- `course-delete` ([Delete button for courses](01-delete-button-for-courses.md)) — same root need (a growing, unmanageable course list).
- `#104` (self-serve course building) — "hand over building capabilities to other people"
  is that issue's access-control question, not a new one.
- `whitelabel` tenant model — may already provide a coarse grouping (by tenant) worth
  checking before inventing a separate folder concept.

## Next step

Run `/grilling` + a PRD pass once picked up — worth grilling together with [Delete button for courses](01-delete-button-for-courses.md) given the
shared motivation, rather than in isolation.

## Done when

The folders-vs-tags decision, whether the tenant model already gives this for free, the one-vs-many membership rule, and the permissions model are settled — grilled together with course-delete, not in isolation.

<!-- Migrated 2026-07-30 from GitHub issue #105 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `course-organization` map (2026-08-01)

<!-- was .plan/maps/authoring/assets/deferred/folders-and-collections.md; that single-ticket map was consolidated into course-management -->

- The ask tangles three things; **separate them before grilling**: grouping structure,
  cleanup/pruning, and delegating building to other people.
- Two of the three already have owners:
  [Delete button for courses](01-delete-button-for-courses.md) (pruning) and
  [Self-serve course building](../../../authoring/assets/deferred/self-serve-course-building.md)
  plus [Co-authorship / ownership transfer](../../../technical-foundation/tickets/07-co-authorship-and-ownership-transfer.md)
  (delegation). This ticket owns **only the grouping**.
- **Check before inventing:** whitelabel's tenant model may already give a coarse grouping
  for free. A new folder concept that duplicates tenant scoping is the failure mode here.
- Prior art check done at filing: no existing folder/collection ticket.
  [Course modules](04-modules-and-per-module-unlocking.md) groups *Lessons within one
  course* — a different concept, not this.
- **Grill together with the delete ticket** — shared motivation.
- Skills: `/grilling` + `/domain-modeling`, `/ponytail` (flat tags may be the whole answer).
- **Fog:** whether tenant-admins get this too. Depends on how far whitelabel's two-tier admin
  model already reaches; sharpens once the admin-only-or-not question is answered.
