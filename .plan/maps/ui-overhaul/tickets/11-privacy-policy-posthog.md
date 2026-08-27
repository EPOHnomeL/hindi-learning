---
type: task
blocked_by: [09]
---
# Disclose PostHog in the privacy policy

> `/wayfinder .plan/maps/ui-overhaul/tickets/11-privacy-policy-posthog.md`

## Question

**This is the gate, not paperwork.** The no-banner stance (2026-08-02) rests on two
things being true: the masking is real (ticket 09) and the policy says what is
happening. `src/app/(legal)/privacy/page.tsx` is already POPIA-framed and already
speaks about operators, so this is an addition in its existing voice, not a rewrite.

## Todo

- [ ] Name **PostHog as an operator** processing personal information on the app's
      behalf.
- [ ] Say **session recordings are captured**, in plain language, and mirror ticket
      09's masking exactly. A policy that overclaims the masking is worse than one
      that says less.
- [ ] State the **cross-border transfer** to PostHog Cloud in the EU, per POPIA s72.
- [ ] State that an internal account identifier alone identifies a person. No email,
      name or phone.
- [ ] Give an **objection route**, since there is no banner offering one up front.
- [ ] Ship it to **prod**, before ticket 10 enables replay there.

## Notes

Two known problems live on this page and belong to other maps. Leave them
deliberately rather than discovering them twice: the hardcoded "My Course" and
`support@my-course.app` (whitelabel map) and the English-only legal pages
(app-language-i18n). The second has a practical edge here: a non-English-reading
learner is recorded on the strength of a disclosure they cannot read.

## Done when

The privacy page discloses the operator, the recordings, the masking, the EU transfer
and the objection route, matching ticket 09 exactly, and it is live in prod.
