# course-publishing/01: Model free self-enroll — the grant primitive, granularity & resolver precedence

**Status:** open
**Depends on:** —
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

## Question

Self-enroll is the **new access primitive** — today there is *no* "enroll": read access resolves
only from ownership, a `shares` row, an `entitlements` row, or a `publicLinks` token (see the map's
pinned facts). This ticket is the deepest cut and blocks the publish model, the catalogue, and the
PRD. Decide, via `/grilling` + `/domain-modeling` (expect an ADR out of it):

1. **The grant primitive** — when a member self-enrolls in a free published course, what row is
   written? Candidates:
   - a new **`enrollments`** table (a first-class, self-initiated grant, distinct from owner-granted
     shares and paid entitlements);
   - a **free `entitlements`** row (amount 0 / no `pfPaymentId`) — reuses the paid read path exactly,
     but overloads "entitlement" to mean both bought and self-claimed;
   - a **self-granted `shares`** row — reuses the "shared with me" read path, but overloads "share"
     (owner-granted) with a self-service act.
   Weigh against `/ponytail` (fewest new concepts) vs. clarity of the access model.
2. **Granularity** — pricing, listings, shares and public links are all per-Edition `(topic, lang)`.
   Is self-enroll per-Edition too (join the English edition; other languages separate), or
   per-**course** (join the course, get whatever editions)? Must be consistent with how "publish"
   and the catalogue will present a course (ticket 03/05).
3. **Resolver precedence & coexistence** — how the enroll grant reads alongside existing grants in
   the access resolver (`lib.ts`): a course that is published-free *and* has owner shares *and* is
   later priced; a private (unpublished) course stays grant-only; what an enroll grant means if the
   course is un-published or a price is later added.

Out of scope for this ticket (and the map): member-initiated **un-enroll** — self-enroll is one-way
for v1.

Record the resolution as a comment + the ADR link, close, and add a Decisions-so-far line to the map.
