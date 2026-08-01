# Onboarding

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The first-run experience made concretely smoother: the friction a new person actually hits,
named and fixed — from the cold sign-up through to the first moment inside a course — not a
vague aspiration.

## Notes

<!-- Ticket 02 arrived 2026-08-01 from the retired single-ticket `welcome` map; it carries
     that map's context folded in under a "Context folded from" heading. -->

- **Two tickets, two moments, one funnel.**
  [Improve onboarding flow](tickets/01-improve-onboarding-flow.md) is everything *up to and
  including* getting an account; [the welcome panel](tickets/02-first-open-welcome-panel.md)
  is the first moment *inside* a course, for a signed-in learner or a Guest on a Public link.
  They were charted apart and kept colliding — 01's walkthrough will land squarely on 02.
- **02 is the more specified of the two** and is takeable without waiting on 01: both reader
  shells (`CourseShell.tsx`, `PublicReader.tsx`) drop a newcomer straight into lesson content,
  and `EmptyLibrary` does not cover it. Its content comes from what already exists — no
  authoring, no new pipeline.

- **The ticket is one sentence** (*"This should be as smooth as possible"*), so the first
  session's real job is **turning it into observations**: walk a genuine cold sign-up on prod,
  on a tenant subdomain, on a phone, and write down every place a person stalls. Until that
  exists there is nothing to build.
- **Two funnel leaks were already diagnosed** for the ywampotch launch — checkout abandonment
  and sign-up friction — and the mechanical half was attacked there (Google sign-in, the
  manual EFT rail, brand continuity). Read
  [ywampotch-launch](../ywampotch-launch/map.md) before re-diagnosing.
- **Two adjacent maps own pieces of this; do not absorb them:**
  [Scope the onboarding & marketing video](../media-generation/tickets/03-scope-onboarding-and-marketing-video.md)
  (the pre-signup pitch) and
  [Review session management](../auth-sessions/tickets/02-review-session-management.md)
  (having to sign in repeatedly, which is onboarding friction every single visit).
- Skills: `/grilling`, `/run` (walk the real app — this map is worthless from the armchair).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Everything downstream of the walkthrough.** Fog stays fog here deliberately: the observations
  come first, and the tickets are cut from them.
- **Whitelabel treatment of the welcome panel.** A tenant's panel arguably needs that tenant's
  voice, not just its palette. Not yet sharp.

## Out of scope

- Checkout mechanics — owned by the launch work and [marketplace](../marketplace/map.md).
- The dashboard empty state (`EmptyLibrary`) — already shipped, different audience.
