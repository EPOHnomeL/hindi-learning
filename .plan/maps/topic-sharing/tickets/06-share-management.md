---
type: task
blocked_by: []
---

# Share management & edge cases

## Question

**Where it stands:** partial — pending-shares + idempotent multi-Viewer shareTopic shipped; listShares, unshareTopic, revoke/recipient-list UI, self-share refusal, and topic-delete cascade are NOT built

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (**Share**, **Viewer**). Spec: `../PRD.md`.

## Want

The owner fully manages a Topic's Shares — see who it's shared with, add more,
revoke — and the sharing edge cases all behave. Rounds out the owner-facing
panel from **01**.

## Acceptance

- `listShares` returns a Topic's current Viewers; the Share panel lists them,
  each with a remove control.
- `unshareTopic` revokes a Share; the Topic disappears from that Viewer's
  "Shared with me" immediately, and they lose read access.
- A Topic can be shared with many Viewers from the panel.
- Edge cases:
  - sharing to one's **own** email is refused;
  - sharing to an email **already** shared is idempotent (no duplicate, no error);
  - sharing to an email with **no account** is held as a *pending Share* and
    claimed on sign-up (done — `pendingShares`, `claimPendingShares`), not an error;
  - **deleting a Topic** removes its Shares (no dangling Viewer references).
- Tests (Convex seam) cover the lifecycle (share / list / revoke / many Viewers)
  and each edge case.

## Depends on

- **01** (needs the `shares` relation and `shareTopic`).

## Notes

- Covers PRD stories 3, 4, 5, 6, 7, 8, 9. Independent of **02–05**.

## Comments

### EPOHnomeL — 2026-07-10

**Verified 2026-07-10 (main @ 1b2db94) — partially stale since ADR 0020 (68e2fe5, a7c570f).**

Already shipped under different names: `listShares` ≈ `listEditionAccess` (shares.ts:131, per-Edition roster of accepted + pending), `unshareTopic` ≈ `revokeShare` (shares.ts:209), and the recipient-list/revoke UI (`AccessRoster` with per-row revoke + role toggle, Editions.tsx:233-313). Lifecycle test coverage in sharing-readonly.test.ts:239-333.

**Actual remaining scope:** self-share refusal (`shareTopic` never compares the recipient to the owner's own email, shares.ts:17-62) and the topic-delete share cascade — noting that no topic-delete mutation exists at all yet (only `deleteLesson`), so the cascade is moot until one does.

## Done when

Taking the 2026-07-10 verification above as the real starting point (the roster and
revoke already ship as `listEditionAccess` / `revokeShare`): `shareTopic` refuses a
share to the owner's own email, and the topic-delete share cascade is either built
alongside a topic-delete mutation or explicitly parked until
[course-delete/01](../../course-delete/tickets/01-delete-button-for-courses.md) lands
one. Both covered by Convex-seam tests.

<!-- Migrated 2026-07-30 from GitHub issue #101 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->
