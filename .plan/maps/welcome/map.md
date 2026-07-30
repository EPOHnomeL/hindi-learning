# Welcome panel

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A first-time reader — signed-in or a Guest on a Public link — gets oriented once, with enough
to decide to continue: what this course is, how big it is, and the next lesson to click.

## Notes

- **The gap is specific:** both reader shells drop a newcomer straight into lesson content
  with no orientation. `EmptyLibrary` does not cover it — it only fires for a signed-in
  learner who owns nothing *and* cannot author, so someone opening a shared or purchased
  course never sees it, and a Guest never sees the dashboard at all.
- **Two shells, one component:** `CourseShell.tsx` (signed-in) and `PublicReader.tsx`
  (Guest / Public link). A Welcome that only appears for signed-in learners misses the colder
  of the two audiences.
- **"Once" is the hard part, and it differs per audience.** A signed-in learner's dismissal can
  persist server-side; a Guest has no account, so it has to be local. Get both right or the
  panel becomes an every-visit nag.
- Content is drawn from what already exists — the served Edition's title, lesson count, and
  the next lesson — so this needs no authoring and no new content pipeline.
- **Distinct from its neighbours:**
  [onboarding/01](../onboarding/tickets/01-improve-onboarding-flow.md) is the whole first-run
  flow, and
  [onboarding-video/01](../onboarding-video/tickets/01-scope-onboarding-and-marketing-video.md)
  is the pre-signup pitch. This is the moment *after* they are already in a course.
- Skills: `/tdd`, `/prototype` (a panel is worth seeing before it is specced further),
  `/run` (check it on a real Public link, not just signed in).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whitelabel treatment.** A tenant's Welcome panel arguably needs that tenant's voice, not
  just its palette. Not yet sharp.

## Out of scope

- The dashboard empty state (`EmptyLibrary`) — already shipped, different audience.
