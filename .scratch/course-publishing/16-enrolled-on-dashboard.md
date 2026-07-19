# course-publishing/16: Surface enrolled courses on the dashboard

**Status:** ready-for-agent (safe to defer — see note)
**Depends on:** 09
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth:
[ADR 0023](adr-0023-draft-self-enroll-access-primitive.md) (the "my enrolled courses" query it names as
*future*), [ticket 01](01-model-self-enroll-grant.md).

## Why

After joining a course from the catalogue, a learner should find it on their **dashboard home** — the
same place owned, shared, and purchased courses already live — not only behind the catalogue's "My
courses" filter. This closes the loop so `enrolled` is a first-class card, matching the "Joined" badge
the resolver already distinguishes ([issue 09](09-enrollments-and-enrolled-grant.md)).

## Deferral note

ADR 0023 calls the dedicated "my enrolled courses" query **future**, and the catalogue's own **My
courses** filter ([issue 15](15-catalogue-surface.md)) already makes a joined course reachable. So this
is the **one issue safe to drop** if v1 scope tightens — the feature is correct without it, just
slightly asymmetric (joined courses reachable via the catalogue but not the home grid). Include it to
finish the loop; cut it under pressure.

## Scope

A query — `listEnrolledTopics` — the **enrollment twin** of `shares.listSharedTopics` /
`market.myPurchases` (`market.ts:120`): one card per Topic, grouping the Editions the caller has
enrolled in (via `enrollments` `by_user`), with the caller's **own** progress counts and the same
`langs` `{ lang, name, native, rtl }` shape. Card title in an enrolled Edition (English if held, else
the first).

- **Exclude overlaps** — don't double-list a course the caller also owns / holds a Share or entitlement
  for (those already render via their own sections). An enrollment is shown only when it's the caller's
  *sole* relationship to the course, or render a single card with the strongest badge — mirror whatever
  de-dup the existing dashboard sections already do; don't invent a new rule.
- **Wire into the dashboard home** beside the existing owned/shared/purchased sections, reusing
  `CourseCard`. A "Joined" section (or merged into the existing grid with the Joined badge) — match the
  current layout; laziest integration that reads consistently.

## Tests (write first)

- `listEnrolledTopics` returns one card per enrolled Topic with the caller's progress and held Editions.
- A course the caller both owns and (somehow) enrolled in isn't double-listed.
- The card links into the course (Continue).

## Acceptance criteria

- A joined course appears on the dashboard home with a Joined badge and correct progress.
- No course is double-counted across owned/shared/purchased/enrolled sections.
- Typecheck / codegen clean; reads indexed (`enrollments.by_user`).

**Closes the map's destination** once shipped alongside 09–15.
