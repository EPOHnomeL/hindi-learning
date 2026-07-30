---
type: task
blocked_by: [09]
---

# Surface enrolled courses on the dashboard

## Question

After joining a course from the catalogue, a learner should find it on their **dashboard home** — the
same place owned, shared, and purchased courses already live — not only behind the catalogue's "My
courses" filter. This closes the loop so `enrolled` is a first-class card, matching the "Joined" badge
the resolver already distinguishes ([issue 09](09-enrollments-and-enrolled-grant.md)). Ground truth:
ADR 0023 (which calls the "my enrolled courses" query *future*), [ticket 01](01-model-self-enroll-grant.md).

**Deferral note:** ADR 0023 calls the dedicated "my enrolled courses" query **future**, and the
catalogue's own **My courses** filter ([issue 15](15-catalogue-surface.md)) already makes a joined
course reachable. So this is the **one issue safe to drop** if v1 scope tightens — the feature is
correct without it, just slightly asymmetric.

Scope — a query `listEnrolledTopics`, the enrollment twin of `shares.listSharedTopics` /
`market.myPurchases` (`market.ts:120`): one card per Topic, grouping the Editions the caller enrolled
in (via `enrollments` `by_user`), with the caller's own progress counts and the same
`langs` `{ lang, name, native, rtl }` shape (card title in an enrolled Edition, English if held).
- **Exclude overlaps** — don't double-list a course the caller also owns / holds a Share or
  entitlement for; mirror whatever de-dup the existing dashboard sections do; don't invent a new rule.
- **Wire into the dashboard home** beside owned/shared/purchased, reusing `CourseCard` — a "Joined"
  section or merged into the grid with the Joined badge; laziest integration that reads consistently.

Tests (write first): `listEnrolledTopics` returns one card per enrolled Topic with the caller's
progress and held Editions; a course the caller both owns and enrolled in isn't double-listed; the
card links into the course (Continue).

## Done when

A joined course appears on the dashboard home with a Joined badge and correct progress; no course is
double-counted across owned/shared/purchased/enrolled sections; typecheck / codegen clean; reads
indexed (`enrollments.by_user`).

## Answer

**Not built as specced — and rendered moot by the build's shape** (build 2026-07-28; decision of record
`docs/adr/0024-publish-at-the-edition-grain.md`). This was the explicitly safe-to-defer issue. Because
publishing went per-Edition and a **free published Edition reads ≡ a Viewer with no join click and no
`enrollments` row** ([issue 13](13-self-enroll-mutation.md)), there is nothing for a dedicated "my
enrolled courses" query to read — `enrollments` (ADR 0023) stays in place but is never written, so the
`listEnrolledTopics` dashboard surface this ticket proposed has no rows to list and was not built.
Published courses surface via the available-courses section on the signed-in home
([issue 15](15-catalogue-surface.md)); a free one is simply Open. The loop-closer is therefore absent
by design of the shipped model, not merely deferred.
