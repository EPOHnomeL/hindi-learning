---
type: task
---
# Sign up for PostHog Cloud EU and provision the keys

> `/wayfinder .plan/maps/ui-overhaul/tickets/07-posthog-signup-eu.md`

## Question

HITL provisioning that the rest of the PostHog strand waits on. Nothing to decide.
Two settled facts, from grilling 2026-08-02, that this ticket must not get wrong:
**EU region** (fixed at signup, unmigratable, and the easier POPIA s72 story for a
South African user base) and **one project for all tenants** (tenancy is a property
and a group, per ticket 09).

## Todo

- [ ] Sign up at <https://eu.posthog.com>. Confirm the **eu.** host before creating
      the account.
- [ ] Create **one** project for the whole app, not one per tenant.
- [ ] Record the project API key (`phc_...`) location and the API host
      (`https://eu.i.posthog.com`).
- [ ] Create a **personal** API key as well; ticket 08 needs it.
- [ ] Record the plan's event and session-recording limits, so ticket 09 sizes the
      taxonomy against a real number.
- [ ] Wire nothing into the app. That is ticket 10, gated on 09 and 11.

## Done when

The EU project exists and the Answer carries the key locations, the API host, and the
plan limits.
