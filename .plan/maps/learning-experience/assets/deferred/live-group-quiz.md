<!-- NOT A TICKET. Deferred 2026-09-01 in the .plan consolidation: this was a ticket on a map
     that no longer exists, and its subject is now a fog patch under "## Not yet specified" on the
     learning-experience map. Kept verbatim (frontmatter stripped) so re-cutting it as a ticket costs nothing but a
     `git mv` back into tickets/ and a number. Nothing here is a commitment. -->


# Scope in-platform live group quiz (Kahoot-style course demo)

## Question

## Why

"Kahoot integration vir course demo" — resolved 2026-07-15: a **host-led, Kahoot-style live
quiz built into the platform** (join code, big-screen host view, live leaderboard), sourced
from a course's existing lesson quizzes, used to demo a course to a live group (a class, a
church group, an org — exactly the whitelabel tenants' audiences). Kahoot names the UX, not a
vendor integration. Convex's reactivity is a natural fit — this is the rare feature where the
backend choice does half the work.

## Questions to answer

- Question source: lesson quizzes live as captured-quiz markup inside immutable lesson HTML —
  can they be harvested reliably (parse the blob? does
  [`quizShuffle.ts`](../../../../../convex/quizShuffle.ts) imply a parseable structure?), or does a
  live session need its own curated question set (owner picks N questions)?
- Session model: host = Topic owner? Players join by code — anonymous (no account, like
  [[Guest]]) or named-on-join? One-off sessions or reusable?
- State machine: lobby → question (timed) → reveal → leaderboard → next → podium; where does
  per-session state live (a `liveSessions` table; presence via `@convex-dev/presence`)?
- The demo job: does a session end with a call-to-action (course public link, sign-up,
  purchase)? Does the host see a post-session capture (who played, contact opt-in) — the
  marketing payoff — or is that scope creep for v1?
- Access & flags: is live quiz a tenant-flagged feature (whitelabel/04)? Cost: no LLM needed
  (pure realtime) — confirm zero-AI assumption.
- Naming: propose the CONTEXT.md term — **Live Quiz**? **Quiz Session**? (Avoid "session",
  overloaded with auth.)

## Out of scope

- Actual Kahoot (the vendor) export/import.
- Multi-course tournaments, persistent player accounts, prizes.

## Deliverable

The question-source decision (harvest vs curate), the session/state model, the anonymous-join
answer, and the v1 cut-line on the marketing capture.

## Done when

The question-source decision (harvest the lesson quizzes vs curate a set), the session/state model, the anonymous-join answer, and the v1 cut-line on the post-session marketing capture.

<!-- Migrated 2026-07-30 from GitHub issue #78 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `live-quiz` map (2026-08-01)

<!-- was .plan/maps/learning-experience/assets/deferred/live-group-quiz.md; that single-ticket map was consolidated into pedagogy -->

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
- **Fog:** the post-session marketing capture — who played, contact opt-in, the call-to-action
  at the end; possible v1 scope creep, sharpens once the session model exists.
- **Out of scope:** actual Kahoot import/export; multi-course tournaments, persistent player
  accounts, prizes.
