# topic-sharing/06: Share management & edge cases

**Status:** partial — pending-shares + idempotent multi-Viewer shareTopic shipped; listShares, unshareTopic, revoke/recipient-list UI, self-share refusal, and topic-delete cascade are NOT built
**Depends on:** **01** (needs the `shares` relation and `shareTopic`)
**Imported:** from GitHub #34 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/topic-sharing/issues/06-share-management.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/topic-sharing/issues/06-share-management.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

The owner fully manages a Topic's Shares — see who it's shared with, add more,
revoke — and the sharing edge cases all behave. Rounds out the owner-facing
panel from **01**.

## Acceptance criteria

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

## Notes

- Covers PRD stories 3, 4, 5, 6, 7, 8, 9. Independent of **02–05**.

## Comments

### EPOHnomeL — 2026-07-10

**Verified 2026-07-10 (main @ 1b2db94) — partially stale since ADR 0020 (68e2fe5, a7c570f).**

Already shipped under different names: `listShares` ≈ `listEditionAccess` (shares.ts:131, per-Edition roster of accepted + pending), `unshareTopic` ≈ `revokeShare` (shares.ts:209), and the recipient-list/revoke UI (`AccessRoster` with per-row revoke + role toggle, Editions.tsx:233-313). Lifecycle test coverage in sharing-readonly.test.ts:239-333.

**Actual remaining scope:** self-share refusal (`shareTopic` never compares the recipient to the owner's own email, shares.ts:17-62) and the topic-delete share cascade — noting that no topic-delete mutation exists at all yet (only `deleteLesson`), so the cascade is moot until one does.
