# Session management

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A signed-in learner stops being asked to sign in again — or, if the work that shipped already
fixed it, this is closed with the evidence written down.

## Notes

- The complaint, verbatim: *"Users need to constantly sign in everytime they go to the website
  its too much."* Filed 2026-07-24.
- **This may already be fixed.** The google-signin effort shipped "persist auth cookies across
  browser restarts" (closed on GitHub as google-signin/01), which is the same symptom. **So
  the first session's job is measurement, not building:** how long does a session actually
  survive today, on a real device, on a tenant subdomain? Reproduce or close.
- **Tenant subdomains are the sharp edge worth checking.** Courses serve from
  `<slug>.my-course.app`, and cookie scope across subdomains is exactly where a session
  silently fails to carry. Note that per-tenant session isolation was itself a deliberate
  decision (closed on GitHub as tenant-session-isolation/01, superseding part of ADR 0022) —
  so "sign in again on another tenant" may be *intended*, and this ticket must not undo it by
  accident.
- **Related but distinct:**
  [password-reset/01](../password-reset/tickets/01-forgot-password-flow.md) is being able to
  sign in at all; [pwa/02](../pwa/tickets/02-download-course-for-offline.md) bundles the same
  complaint into its download ask.
- Real accounts exist only on prod, so measurement is a prod activity.
- Skills: `/diagnose` (this is a reproduce-first ticket, not a design one),
  `convex:convex-setup-auth`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Adding more sign-in providers — Google already shipped.
- Undoing per-tenant session isolation, which is a decided position.
