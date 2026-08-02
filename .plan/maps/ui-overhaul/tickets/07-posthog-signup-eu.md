---
type: task
---
# Sign up for PostHog Cloud EU and provision the keys

> `/wayfinder .plan/maps/ui-overhaul/tickets/07-posthog-signup-eu.md`

## Question

Manual (HITL) provisioning that every PostHog ticket on this map waits on. The
decisions are already made (grilling, 2026-08-02) and are **not** reopened here:

- **PostHog Cloud, EU region.** Not US, not self-hosted. The region is fixed at
  signup and cannot be changed later without losing history, so this is a one-way
  door — pick EU deliberately. EU is the easier POPIA §72 cross-border story for a
  South African user base than the US, and the shorter hop from SA.
- **One project for all tenants** (`upf`, `ywampotch`, `almighty-warriors`, `yknot`
  and the default site). Tenancy is a property and a group, never a separate
  project — see ticket 09.

Checklist for the human:

1. Sign up at <https://eu.posthog.com> — confirm the URL is the **eu.** host before
   creating the account. A US-region account cannot be migrated.
2. Create **one** project for the whole app (not one per tenant).
3. Grab the **project API key** (`phc_…`) and the **API host** (`https://eu.i.posthog.com`).
4. Create a **personal API key** as well — ticket 08's MCP authorization needs it.
5. Note the plan and any free-tier limits on event and recording volume, so ticket
   09 can size the taxonomy against them rather than guessing.
6. Do **not** wire anything into the app yet — that is ticket 10, and it is gated on
   the masking policy (09) and the privacy-policy disclosure (11).

## Done when

A PostHog Cloud **EU** project exists, and the Answer records: the project API key
location, the API host, that a personal API key exists for 08, and the plan's event
and session-recording limits.
