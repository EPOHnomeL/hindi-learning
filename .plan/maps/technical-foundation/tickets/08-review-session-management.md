---
type: grilling
blocked_by: []
---

# Review session management

## Question

Users need to constantly sign in everytime they go to the website its too much.

## Done when

The live session lifetime is measured against the auth-cookie persistence that already shipped, and the residual complaint is either reproduced and ticketed, or ruled out with the evidence written down.

<!-- Migrated 2026-07-30 from GitHub issue #47 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `session-management` map (2026-08-01)

<!-- was .plan/maps/auth-sessions/tickets/02-review-session-management.md; that single-ticket map was consolidated into auth-sessions -->

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
- **Related but distinct:** [Forgot-password flow](../../technical-foundation/tickets/21-forgot-password-flow.md) is being able
  to sign in at all;
  [Download course for offline](../../reader-experience/tickets/02-download-course-for-offline.md)
  bundles the same complaint into its download ask.
- Real accounts exist only on prod, so measurement is a prod activity.
- Skills: `/diagnose` (this is a reproduce-first ticket, not a design one),
  `convex:convex-setup-auth`.
- **Out of scope:** adding more sign-in providers — Google already shipped. Undoing per-tenant
  session isolation, which is a decided position.

<!-- Moved 2026-09-01 from `auth-sessions/02` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 08 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
