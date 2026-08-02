---
type: task
blocked_by: [09]
---
# Disclose PostHog in the privacy policy

> `/wayfinder .plan/maps/ui-overhaul/tickets/11-privacy-policy-posthog.md`

## Question

**This is the gate, not paperwork.** The consent stance decided on 2026-08-02 is *no
banner* — which rests on two things being true: the masking is real (ticket 09), and
the policy actually discloses what is happening. Without this ticket the stance has
no leg to stand on. Treat it as a hard precondition for enabling session replay in
prod, ahead of ticket 10's deployment.

`src/app/(legal)/privacy/page.tsx` is already POPIA-framed and already speaks about
operators and third parties, so this is an addition in the page's existing voice,
not a rewrite. It must say:

- **PostHog is an operator** processing personal information on the app's behalf.
- **Session recordings are captured** — what they are, in plain language, and that
  text entered into forms is masked and that checkout and admin surfaces are not
  recorded at all (whatever ticket 09 actually settled — mirror it exactly; a policy
  that overclaims the masking is worse than one that says less).
- **The data leaves South Africa** — a cross-border transfer to PostHog Cloud in the
  **EU**, per POPIA §72.
- **What identifies a person to PostHog**: an internal account identifier only. No
  email, name or phone is sent.
- **How to object**, since POPIA gives data subjects that right and there is no
  banner offering it up front.

Two things to check while in there, both already known problems on other maps — fix
or leave alone deliberately, do not discover them twice:

- The legal pages **hardcode "My Course" and `support@my-course.app`**, which leaks
  through the whitelabel — that belongs to the `whitelabel` map, already recorded in
  this map's Out of scope.
- The legal pages are **English-only** — that belongs to `app-language-i18n`,
  likewise already out of scope here. But note the practical consequence: a
  non-English-reading learner is being recorded on the strength of a disclosure they
  cannot read.

## Done when

The privacy page discloses PostHog, the recordings, the masking, the EU transfer and
the objection route, matching ticket 09's policy exactly — and it is **live in prod**
before replay is switched on there.
