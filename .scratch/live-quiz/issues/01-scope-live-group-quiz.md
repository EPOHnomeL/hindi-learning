# live-quiz/01: Scope in-platform live group quiz (Kahoot-style course demo)

**Status:** open
**Depends on:** —

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
  [`quizShuffle.ts`](../../../convex/quizShuffle.ts) imply a parseable structure?), or does a
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
