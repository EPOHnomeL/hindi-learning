# 06 — Share management & edge cases

Status: partial — pending-shares + idempotent multi-Viewer shareTopic shipped; listShares, unshareTopic, revoke/recipient-list UI, self-share refusal, and topic-delete cascade are NOT built

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

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

- 2026-07-10 — Migrated to GitHub issue [#34](https://github.com/EPOHnomeL/hindi-learning/issues/34); GitHub is now the tracking home for this ticket.
