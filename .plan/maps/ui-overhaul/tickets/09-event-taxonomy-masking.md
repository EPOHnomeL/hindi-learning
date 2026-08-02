---
type: grilling
---
# Event taxonomy and the session-replay masking policy

> `/wayfinder .plan/maps/ui-overhaul/tickets/09-event-taxonomy-masking.md`

## Question

What PostHog is allowed to see, and what it is asked to record. This is unblocked —
it is decidable cold, before the account exists — but tickets 10 and 11 both consume
it, so it lands early.

**The frame, settled by grilling on 2026-08-02 and not reopened here:** the consent
stance is **no banner**. POPIA has no ePrivacy-style cookie-consent rule and
first-party analytics on your own service rests on legitimate interest — so the
masking policy *is* the protection. If the masking is weak, the whole stance is weak.

Decide:

- **Masking.** The default is mask **all** text inputs, not a per-field allowlist —
  an allowlist fails open every time someone adds a field. Which surfaces are
  excluded from recording *entirely* rather than merely masked? Checkout and
  `/admin` were named in grilling; what about the authoring composer, which may hold
  unpublished course content, and the certificate and share routes?
- **Do Not Track.** Honoured — confirm how, given `posthog-js` config.
- **The event taxonomy.** Naming convention, and the minimum set that answers "where
  is this clunky": the sign-up funnel, the first-lesson funnel, and the checkout
  funnel. Resist a wide taxonomy — at ~10 sales of lifetime volume the value is in
  **replay**, not in event counts, and every extra event is quota spent for nothing.
- **Volume sizing.** Against the plan limits ticket 07 recorded: is 100% session
  sampling affordable? At this traffic it almost certainly is, and sampling would be
  actively harmful — you want to watch *every* session.
- **Identity properties.** `identify()` carries the **Convex user id only** — no
  email, name or phone. Confirm which non-PII properties ride along: `tenant`,
  `isAnonymous`, and what else.
- **Tenancy.** `tenant` as both an event property and a PostHog **group**, so
  breakdowns by tenant work natively.

## Done when

A written masking policy and event list precise enough that ticket 10 can be
implemented without reopening any of it, and ticket 11 can state plainly in the
privacy policy what is collected.
