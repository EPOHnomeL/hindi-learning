# Password reset

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A user who forgets their password can get back in by themselves, via an emailed OTP — and the
hand-set temp-password workaround is retired.

## Notes

- **This is a live, confirmed lockout, not a hypothetical.** A real user hit it on
  2026-07-15: sign-in throws `InvalidSecret`, sign-up throws "account already exists", and
  `convex/auth.ts` configures `Password()` with **no `reset` provider**. There is no
  change-password UI either.
- **The operator workaround is documented in the ticket and it is not acceptable long-term** —
  a temp password set by hand stays permanent until this ships.
- **The rail already exists:** Resend sends invite email from this domain, so the reset email
  needs no new infrastructure — a Convex Auth `ResendOTPPasswordReset`-style provider.
- Prod-only reality: real accounts exist only on prod, so any live verification is a prod
  operation with the operator CLIs (`docs/agents/project-context.md`).
- **Related but distinct:**
  [session-management/01](../session-management/tickets/01-review-session-management.md) is
  about not having to sign in so often; this is about being able to at all.
- Skills: `convex:convex-setup-auth`, `convex:convex-expert`, `/tdd`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **A change-password UI for a signed-in user.** Missing too, and adjacent enough that it may
  ride along — but it is a different flow and has not been ticketed.

## Out of scope

- OAuth sign-in — already shipped (Google provider, account linking by email).
