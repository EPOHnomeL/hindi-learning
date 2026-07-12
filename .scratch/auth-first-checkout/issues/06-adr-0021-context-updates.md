# 06 — ADR 0021 + CONTEXT.md: record the new Allowlist semantics

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

The decision record for what this feature changed about the domain.

- **ADR 0021** — "Open sign-up; Allowlist gates course creation": supersedes ADR 0011's
  *sign-up-gate* meaning (the portal/table mechanics stand); records auth-first checkout
  as the impersonation/typo fix, the deferred email-OTP half, and the deletion of
  payment-based admission. *(Main already has ADR 0020 — Editor role; confirm the number
  at merge.)*
- **CONTEXT.md**:
  - **Allowlist** entry redefined: the set of emails permitted to *create courses*;
    sign-up is open; still site-wide, still Admin-governed, still not a session gate.
  - Monetisation section: the "buyers are admitted by payment, bypassing the Allowlist"
    reshaping bullet dies; the pending-Entitlement bullet dies with the table; guest-first
    buying language becomes auth-first.
  - **Admin** entry: still governs the Allowlist — the list answers "who may create
    courses" now.
- Sweep remaining copy/comments that describe sign-up as gated or buying as guest-first
  (auth.ts header comment, Paygate/SignIn comments, whitelist.ts header).

## Acceptance criteria

- [ ] ADR 0021 committed, linked from ADR 0011 as superseding its admission semantics.
- [ ] CONTEXT.md entries match the shipped behaviour; no stale "private workspace"/"guest buying" language greps out of docs or code comments.
- [ ] `pnpm documentation` registries updated if the knowledge bank lists ADRs (per `docs/architecture/README.md`).

## Blocked by

- [05 — Delete the guest-purchase machinery](05-delete-guest-purchase-machinery.md)
  (write the record once the behaviour it records is true)
