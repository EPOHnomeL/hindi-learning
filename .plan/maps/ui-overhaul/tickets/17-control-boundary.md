---
type: grilling
blocked_by: [15]
---
# Which controls belong to sharing, which to course settings, which to the account

> `/wayfinder .plan/maps/ui-overhaul/tickets/17-control-boundary.md`

## Question

Four controls sit in the wrong dialog, and the code comments admit it. Teacher Q&A is
per Topic but renders inside a per-language panel, so its hint has to spend two lines
explaining that it governs the whole course. Seller onboarding and the payout bank
form are per user, yet they live inside one edition's price card. The access roster is
per edition, but the depth an owner wants from it belongs to the topic-sharing map.
Meanwhile Course settings holds title, mission, the certificate emblem, the completion
lifecycle and a delete-a-lesson list, which is authoring rather than settings.

Decide where each of these lives once the sharing panel is reorganised:

- Teacher Q&A. Course settings is my prior, since it is a course-wide switch.
- Seller grant and payout bank details. Account settings at `/settings` would stop
  every edition repeating a one-time setup.
- The access roster. Placement is this ticket's call. Its edge cases and the learner
  insights view stay with topic-sharing tickets 06, 08 and 09.
- Lesson deletion and the completion lifecycle. Settings, or the authoring surface.
- Whether an Editor, who today sees Details only, sees anything else after the move.

Every control here is owner-only server-side. Moving one must not widen who can call
it, and `convex:convex-authz` is the check on that.

## Done when

The Answer is a table of control to destination surface, each with a one-line reason,
covering every control now rendered by `Editions.tsx` and `CourseSettings.tsx`. Any
control that moves to `/settings` names the section it lands in. The Editor's view is
stated explicitly.
