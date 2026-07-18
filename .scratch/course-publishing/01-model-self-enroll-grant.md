# course-publishing/01: Model free self-enroll — the grant primitive, granularity & resolver precedence

**Status:** done (2026-07-18, `/grilling` + `/domain-modeling`)
**Claimed:** 2026-07-18 (session continuing from whitelabel-handoff-session-2026-07-18.md)
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

## Resolution (2026-07-18)

Captured as [ADR 0023 draft — Self-enroll as a first-class access primitive](adr-0023-draft-self-enroll-access-primitive.md).

1. **Primitive:** a new **`enrollments`** table — *not* a reused free `entitlements` row or self-
   `shares` row. Both reuses would mislabel a self-join under "Purchases" / "Shared with me" (this is
   a discovery feature — the label is what the learner sees) and pollute the ledger/role invariants.
   The dedicated table keeps `entitlements` = money and `shares` = owner-granted.
2. **Granularity:** per-**Edition** — row `{ userId, topicId, lang }` — matching the grain of every
   other grant and the resolver seam.
3. **Resolver precedence & coexistence:** `editionAccessLevel` gains one branch returning a distinct
   **`enrolled`** level (parallel to `entitled`, treated ≡ viewer for access, kept distinct for the
   "joined" badge + a future "my enrolled courses" query). The enrollment is a **permanent /
   grandfathered** grant: if a previously-free Edition is later **priced**, already-enrolled users
   keep full access (the enrollment check wins regardless of current price); only *new* free joins
   stop. Enrollment rows are created only for a currently-free, **published** Edition (creation-side
   guard — tickets 03/05), idempotent per `(user, topic, lang)`. **Private/unpublished courses stay
   grant-only** (no catalogue → no self-enroll path); existing enrollments grandfather on unpublish.

**Surfaced (fed back into the map):** the user added a **language axis** — access should be scoped to
a user's chosen content language, cross-language courses shown *disabled* in the catalogue, gated by
the tenant `translations` flag; and a separate desire to translate the **whole app UI** ("app in
English, enrol in another language"). Split three ways (user decision 2026-07-18): (1) per-language
enrollment = this ticket; (2) **language-scoped access + user content-language** = new
[ticket 07](07-language-scoped-access.md) on this map; (3) **full app-UI translation** = its own
future effort (map fog pointer). **Whether** a user may enrol in a given language is ticket 07's job,
not this one.
