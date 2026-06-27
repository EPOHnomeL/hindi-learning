---
slug: access-sharing
name: Access & Sharing
position: 5
status: draft
adrs: [0011]
---

# Access & Sharing

Two independent gates: **who may sign up** (the [[Allowlist]], governed by one [[Admin]] —
[ADR 0011](/docs/adr/0011-allowlist-in-convex-admin-portal.md)) and **who may read a [[Topic]] they
don't own** ([[Share]]s granting a [[Viewer]] read-only access). They are wired separately — sharing
governs reads, the allowlist governs sign-up.

## Allowlist (sign-up gate)

The backend is [whitelist.ts](/convex/whitelist.ts). Emails are normalised (trim + lowercase) on both
store and lookup ([`normaliseEmail`](/convex/whitelist.ts#L12-L14)), so every check is a plain equality
on `by_email`. The one admission decision is
[`isEmailAdmitted`](/convex/whitelist.ts#L19-L25) — **an empty table admits nobody** (closed by design).

The Admin (an account whose email has an `isAdmin` whitelist row) manages it through Admin-only
functions, each guarded by [`requireAdmin`](/convex/whitelist.ts#L59-L70):
[`list`](/convex/whitelist.ts#L73-L81), [`addEmail`](/convex/whitelist.ts#L104-L113),
[`removeEmail`](/convex/whitelist.ts#L119-L133). [`amIAdmin`](/convex/whitelist.ts#L86-L100) backs the
`/admin` route guard (UX only — the real boundary is `requireAdmin` on every call). First-row bootstrap
is [`seedEmail`](/convex/whitelist.ts#L138-L145) via `npx convex run`.

> **WIP — the gate isn't switched over yet.** Today [auth.ts](/convex/auth.ts#L11-L25) still gates
> sign-up on the `AUTH_ALLOWED_EMAILS` **env var**, not the `whitelist` table. The table, Admin portal,
> and `isAdmitted` query are built and tested ([ADR 0011](/docs/adr/0011-allowlist-in-convex-admin-portal.md))
> but not yet called from the auth path. Both code paths normalise identically, so swapping them is the
> remaining step.

## Sharing (read gate)

The read-side authorization lives in one helper —
[`getViewableTopic`](/convex/lib.ts#L31-L40): return the Topic if the caller **owns** it, else if a
`shares` row matches `(topicId, viewerId)` on `by_topic_viewer`. Every content read query
(`listLessons`, `getLesson`, `listReferences`, `getReference`) routes through it. Writes route through
`getOwnedTopic` instead, so a Viewer is read-only by construction.

[shares.ts](/convex/shares.ts): the owner calls
[`shareTopic`](/convex/shares.ts#L13-L28) naming the Topic and the Viewer's **email** — the account
must already exist or the call throws. [`listSharedTopics`](/convex/shares.ts#L33-L67) powers the
Viewer's "Shared with me" feed (showing the owner's email and the **owner's** progress).

A Viewer **can** read all Lessons/References and see their own dashboard entry; a Viewer **cannot**
edit the Mission, rename, add Resources, ask Questions, mark Progress, fire the Routine, or re-share.

## Gotchas

- **Sign-up gate ≠ session gate.** Removing an email blocks *new* sign-ups only; existing accounts keep
  their access and can still sign in ([whitelist.ts:117](/convex/whitelist.ts#L115-L133)).
- **The Admin row can't be removed** — [`removeEmail`](/convex/whitelist.ts#L129) refuses it, so the
  Admin can't lock themselves out. There is exactly one Admin.
- **A Share needs a pre-existing account** (lookup by email in [shareTopic](/convex/shares.ts#L13-L28));
  you can't invite a stranger.
- **Read-gate and write-gate are independent.** Viewer read-only is enforced because writes use
  `getOwnedTopic`, not because the schema forbids it.
- **Shares aren't deduped or revoked yet.** `shareTopic` doesn't check `by_topic_viewer` before
  inserting, and Topic delete leaves orphan share rows — revoke/dedup is tracked as future work.
