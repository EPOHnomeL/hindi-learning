---
type: grilling
blocked_by: []
---

# Improve Onboarding Flow

## Question

Where does a new person actually stall on the way to their first lesson?

<!-- Scoped 2026-08-01 from ywampotch-launch 08, which flagged this (as GitHub #46)
     as a one-line stub: "This should be as smooth as possible". A stub looks like
     tracked work and carries none. Kept rather than closed — the map's Destination
     hangs off it — and given the scope below, drawn from the map's Notes so this
     ticket is workable cold. -->

**The job is observation, not building.** Walk a genuine cold sign-up and write
down every place a person stalls — nothing here can be ticketed until that list
exists. Walk it **on prod, on a tenant subdomain (`ywampotch.my-course.app`), on a
phone**, as a stranger with no account:

1. Land on the tenant front door — is the offer legible?
2. Sign up (Google and email both) — count the steps, note every dead end.
3. Reach a course and open lesson one.

For each stall record: where, what the person expected, what happened, and whether
it is a *copy*, *layout*, or *mechanism* problem.

**Read before walking, so you don't re-diagnose what is already known or already
fixed:**

- [ywampotch-launch](../../ywampotch-launch/map.md) already diagnosed two leaks —
  **checkout abandonment** and **sign-up friction** — and attacked the mechanical
  half (Google sign-in, the manual EFT rail, brand continuity, checkout as a page).
- [The welcome panel](02-first-open-welcome-panel.md) owns the first moment
  *inside* a course, and is **built**. This ticket stops at its doorstep.

**Out of scope** — owned elsewhere, do not absorb:
[the pre-signup pitch video](../../media-generation/tickets/03-scope-onboarding-and-marketing-video.md),
[repeat sign-in friction](../../auth-sessions/tickets/02-review-session-management.md),
and checkout mechanics (ywampotch-launch and [marketplace](../../marketplace/map.md)).

## Done when

The flow's actual friction points are named concretely (walked or measured), and each one is either an implementation ticket here or explicitly handed to the welcome / onboarding-video tickets.

<!-- Migrated 2026-07-30 from GitHub issue #46 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
