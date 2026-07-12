# 01 — Open sign-up; Allowlist becomes the course-creation gate

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

Flip the Allowlist's job: sign-up opens to everyone; creating a course is what the
Allowlist now gates.

- `convex/auth.ts` `createOrUpdateUser`: remove the admission checks (`isAdmitted` +
  `hasPendingEntitlement`) — normalise, insert, claim pending **Shares**. Keep the
  pending-Entitlement claim call for now (issue 05 deletes the machinery). The
  "This workspace is private" error dies.
- `convex/content.ts` `seedTopic`: require the caller's account email to be on the
  Allowlist (`isEmailAdmitted`); the 1/day limit and Admin exemption are unchanged.
- `convex/whitelist.ts`: a small public query exposing the caller's Allowlist membership
  (name it after membership — the glossary avoids **Creator**/**Author**; e.g.
  `amIAllowlisted`). Derived from the caller's identity server-side, like `amIAdmin`.
- Dashboard: hide the "new course" affordance for non-members (query above); Admin portal
  copy flips from "who may sign up" to "who may create courses". SignIn screen copy loses
  any private-workspace framing.

## Acceptance criteria

- [ ] An email with no Allowlist row can sign up (test inverts the old closed-workspace case).
- [ ] Pending Shares still claim on sign-up.
- [ ] `seedTopic` throws for a signed-in non-member; an Allowlisted member seeds; 1/day + Admin exemption hold.
- [ ] The membership query answers by Allowlist row, false when signed out.
- [ ] Non-members see no "new course" affordance; members and the Admin see it.
- [ ] Portal copy reads as the course-creation list; `tsc`, tests, build green.

## Blocked by

— (first slice)
