# Live quiz

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A session and question-source model for a **host-led, Kahoot-style live quiz built into the
platform** — join code, big-screen host view, live leaderboard — good enough to demo a course
to a room full of people.

## Notes

- **"Kahoot" names the UX, not a vendor.** There is no Kahoot integration in scope.
- **The audience is the point:** a class, a church group, an org — exactly the whitelabel
  tenants' audiences. This is a *marketing and demo* feature wearing a pedagogy costume.
- **Convex's reactivity does half the work here** — this is the rare feature where the backend
  choice is most of the implementation. `@convex-dev/presence` is the obvious lobby primitive.
- **The question-source fork is the real decision:** lesson quizzes live as captured-quiz
  markup inside *immutable lesson HTML*. Whether that is reliably harvestable (see
  `convex/quizShuffle.ts`) or whether a session needs its own curated set decides the whole
  build.
- **Zero-AI feature** if the assumption holds — pure realtime, no LLM cost. Confirm it early,
  because it makes this unusually cheap to run.
- Naming: avoid "session", already overloaded with auth.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **The post-session marketing capture.** Who played, contact opt-in, the call-to-action at
  the end — named in ticket 01 as possible v1 scope creep. Sharpens once the session model
  exists.

## Out of scope

- Actual Kahoot import/export.
- Multi-course tournaments, persistent player accounts, prizes.
