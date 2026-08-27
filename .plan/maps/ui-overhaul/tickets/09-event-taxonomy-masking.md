---
type: grilling
---
# Event taxonomy and the session-replay masking policy

> `/wayfinder .plan/maps/ui-overhaul/tickets/09-event-taxonomy-masking.md`

## Question

What PostHog is allowed to see, and what it is asked to record. Decidable cold,
before the account exists, and both 10 and 11 consume it.

**The frame, settled 2026-08-02 and not reopened here:** no consent banner. POPIA has
no cookie-consent rule and first-party analytics on your own service rests on
legitimate interest, so **the masking policy is the protection**. Weak masking, weak
stance.

Decide:

- **Masking.** Default is mask all text inputs, never a per-field allowlist, which
  fails open the next time someone adds a field. Which surfaces are excluded from
  recording **entirely**? Checkout and `/admin` were named in grilling. What about
  the authoring composer, which may hold unpublished course content, and the
  certificate and share routes?
- **Do Not Track.** Honoured. Say how, in `posthog-js` config terms.
- **The event list.** Naming convention plus the minimum set that answers "where is
  this clunky": sign-up, first lesson, checkout. Resist a wide taxonomy. At around
  ten lifetime sales the value is replay, and every extra event is quota spent for
  nothing.
- **Sampling.** 100% of sessions, against ticket 07's plan limits. Sampling would be
  actively harmful here; you want every session.
- **Identity.** `identify()` carries the Convex user id only, no email, name or phone.
  Confirm which non-PII properties ride along beyond `tenant` and `isAnonymous`.
- **Tenancy.** `tenant` as both event property and PostHog group, so breakdowns by
  tenant work natively.

## Done when

A written masking policy and event list precise enough that 10 is implementable
without reopening any of it, and 11 can state plainly what is collected.
