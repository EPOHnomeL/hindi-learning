# Auth & sessions

<!-- Charted 2026-08-01 by consolidating two single-ticket maps — password-reset and
     session-management — that were each a lone issue wearing a map's clothes. Each
     ticket carries the context its old map held, folded in under a "Context folded
     from" heading. This map is an INDEX, not a store. -->

## Destination

Getting in and staying in both work without an operator in the loop: a locked-out user
recovers by themselves, and a signed-in learner stops being asked to sign in again.

## Notes

- **Two halves of one complaint, deliberately kept as separate tickets.**
  [Forgot-password flow](tickets/01-forgot-password-flow.md) is being able to sign in *at
  all*; [Review session management](tickets/02-review-session-management.md) is not having to
  do it *so often*. They share the auth surface and nothing else — do not merge them.
- **01 is a live, confirmed lockout, not a hypothetical.** A real user hit it on 2026-07-15;
  `convex/auth.ts` configures `Password()` with **no `reset` provider**, and the operator
  workaround (a temp password set by hand, permanent until this ships) is not acceptable
  long-term.
- **02 may already be fixed** by the auth-cookie persistence that shipped with Google sign-in.
  The first session's job there is **measurement, not building** — reproduce on a real device
  and a tenant subdomain, or close it with the evidence written down.
- **Tenant subdomains are the sharp edge.** Cookie scope across `<slug>.my-course.app` is
  exactly where a session silently fails to carry — but per-tenant session isolation is a
  *decided position* (superseding part of ADR 0022), so "sign in again on another tenant" may
  be intended. 02 must not undo it by accident.
- **Prod is the only place with real accounts**, so both tickets verify against prod with the
  operator CLIs (`docs/agents/project-context.md`).
- The email rail already exists — Resend sends invite email from this domain, so 01 needs no
  new infrastructure.
- Skills: `convex:convex-setup-auth`, `convex:convex-expert`, `/tdd` (01),
  `/diagnose` (02 is reproduce-first, not a design ticket).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **A change-password UI for a signed-in user.** Missing too, and adjacent enough to 01 that
  it may ride along — but it is a different flow and has not been ticketed.

## Out of scope

- Adding more sign-in providers — Google already shipped, with account linking by email.
- Undoing per-tenant session isolation, which is a decided position.
