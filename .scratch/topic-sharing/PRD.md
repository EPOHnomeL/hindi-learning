# PRD: Topic sharing — read-only Viewers

Status: shipped — Shares + Public links delivered (issues 01–07 done); 08 deferred

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — in particular the new
> **Share** and **Viewer** terms added for this feature. No ADR: the one
> foundational choice (existing-accounts-only, no public links, no per-Viewer
> Progress) is a real trade-off but easily extended later, so it doesn't clear
> the hard-to-reverse bar.

## Problem Statement

A learner builds up a Topic — its Mission, Lessons, References, Resources, and
the Questions they've asked Claude Code — but it's locked to their account.
There's no way to let someone else (a tutor, a study partner, a friend learning
the same thing) look at it. Today every Topic is private: the dashboard only
ever shows the signed-in User's own Topics, and every reader query is owner-
scoped through one gate.

## Solution

A Topic owner can **share** a Topic with another **existing** User by entering
that User's account email. This creates a **Share**, granting the recipient —
the **Viewer** — read-only access. The shared Topic then appears in the Viewer's
"Shared with me" section below their own courses, opening into the same Reader
in read-only mode: the Viewer sees everything (Lessons, References, Resources,
the owner's Questions and Replies, the owner's Progress) but writes nothing.

Sharing is targeted (to a known account), not an anonymous public link. The
owner manages sharing from a panel on the Topic's card — adding recipients by
email and revoking them — and a Topic may be shared with many Viewers. Because
Convex queries are live, a Viewer's read-only view updates automatically as the
owner's Topic changes.

## User Stories

### Owner — sharing
1. As an owner, I want a "Share" control on a Topic's card, so that I can share that specific Topic without affecting my others.
2. As an owner, I want to share a Topic by typing the recipient's account email, so that only the intended person gets access.
3. As an owner, I want to share one Topic with several people, so that a whole study group can follow along.
4. As an owner, I want to see who a Topic is currently shared with, so that I know who can view it.
5. As an owner, I want to revoke a Share, so that a person I no longer want viewing the Topic loses access immediately.
6. As an owner, I want a clear error when I try to share to an email that has no account, so that I understand why it didn't work.
7. As an owner, I want sharing to my own email to be refused, so that I don't create a meaningless self-Share.
8. As an owner, I want re-sharing to someone who already has access to be a no-op (not a duplicate or an error), so that the recipient list stays clean.
9. As an owner, I want deleting a Topic to remove its Shares, so that no Viewer keeps a dangling reference to a Topic that no longer exists.
10. As an owner, my own experience of my Topics is unchanged — I retain full read/write on everything I own.

### Viewer — reading
11. As a Viewer, I want a "Shared with me" section below my own courses, so that I can tell shared Topics apart from mine at a glance.
12. As a Viewer, I want each shared card to show whose Topic it is (attribution), so that I know who shared it with me.
13. As a Viewer, I want to open a shared Topic into the normal Reader, so that I get the same reading experience as the owner.
14. As a Viewer, I want to read all the Topic's Lessons and References, so that I can study the material.
15. As a Viewer, I want to see the Topic's Resources (and open them), so that I have the same grounding the owner does.
16. As a Viewer, I want to see the owner's Questions and Claude Code's Replies, so that I benefit from the clarifications already asked.
17. As a Viewer, I want to see the owner's Progress (completion marks), so that I can follow where they are.
18. As a Viewer, I want my read-only view to update as the owner's Topic changes, so that I'm never looking at a stale copy.

### Viewer — write-blocking
19. As a Viewer, I cannot add a Resource to a shared Topic — the upload/link controls are absent, and the operation is refused server-side.
20. As a Viewer, I cannot edit the Mission of a shared Topic — the edit control is absent, and the operation is refused server-side.
21. As a Viewer, I cannot ask a Question on a shared Topic — the ask form is absent, while the existing Questions and Replies stay visible read-only.
22. As a Viewer, I cannot mark a Lesson complete or fire the next-lesson Routine, so that I never mutate the owner's Progress or trigger authoring on their behalf.
23. As a Viewer, I cannot rename, re-seed, delete Resources from, or re-share a shared Topic — every write is owner-only.

## Implementation Decisions

- **A new `shares` relation** records that one Viewer has read-only access to one
  Topic. Created by the owner; a Topic can carry many Shares. Keyed for two
  lookups: by Topic (who can view this?) and by Viewer (what's shared with me?).
- **Targeted, existing-accounts-only.** `shareTopic` takes an email, resolves it
  against the `users` table, and only creates a Share if that account exists;
  otherwise it errors. No tokens, no claim flow, no anonymous links.
- **Read paths widen from owner-only to owner-or-Viewer.** Today every reader
  query funnels through a single owner-scoping gate. A sibling resolver grants
  access when the caller is the owner **or** holds a Share for the Topic; the
  read queries (Lessons, References, Resources, the owner's Questions/Replies,
  the owner's Progress) move onto it. A new query lists the Topics shared **with**
  the caller for the "Shared with me" section.
- **Write paths stay owner-only.** Every mutation continues through the
  owner-only gate, so a Viewer is refused server-side regardless of UI. This is
  the load-bearing guarantee; the UI hiding of controls is convenience on top.
- **No per-Viewer Progress.** A Viewer sees the owner's Progress; they do not get
  their own completion state. (Deferred — would need a per-User Progress model.)
- **Owner share management UI** lives in a panel on the Topic's card (alongside
  the existing open/edit affordances): add-by-email, list current Viewers,
  revoke each. Shared cards (in the Viewer's view) carry no edit/share controls.
- **Viewer surface** is a "Shared with me" section rendered below the owner's own
  course grid, each card attributed to the owner and opening the read-only Reader.

## Testing Decisions

- **Good tests assert external behavior at the Convex function seam**, not
  internals — exactly the style of `convex/content.test.ts`, which seeds Users
  and Topics with `withIdentity` and asserts what each caller can and cannot see.
  Its "cross-owner isolation" test is the direct mirror of what sharing inverts.
- **One seam: the Convex function API**, exercised via `convexTest`. Covered:
  - **Share lifecycle** — share by email; revoke; many Viewers on one Topic.
  - **Edge cases** — self-share refused; duplicate share idempotent; no-account
    email errors; deleting a Topic removes its Shares.
  - **Read access** — a Viewer can read a Topic's Lessons, References, Resources,
    Questions/Replies, and Progress; a non-Viewer still gets nothing; the owner's
    own access is unchanged.
  - **Write-blocking** — a Viewer's `editMission`, `addResource` / `addUrlResource`
    / `generateUploadUrl`, `askQuestion`, mark-complete/Progress writes, and
    next-lesson Routine fire all reject.
- **No new frontend tests** — consistent with the repo, which has none. UI gating
  (the Share panel, the "Shared with me" section, hidden write controls) is
  verified manually; the correctness that matters (can a Viewer write?) is
  enforced and tested server-side.

## Out of Scope

- **Anonymous / public links** — sharing is to existing accounts only. Claimable
  links can be layered on later.
- **Per-Viewer Progress, Responses, or Questions** — a Viewer reads the owner's;
  they get no learning state of their own.
- **Account-wide sharing** ("share all my Topics") — per-Topic only; "share all"
  can be built on top later.
- **Re-sharing by a Viewer** — only the owner shares.
- **Anti–email-enumeration measures** — the existence check is observable; accepted.
- **Notifications** — a shared Topic simply appears on the Viewer's next visit;
  no email/push.
- **Roles beyond owner/Viewer** — no editor/commenter tiers.

## Further Notes

- The feature is almost entirely backend (a `shares` table + read-gate widening +
  share mutations) plus two thin UI surfaces (owner share panel, Viewer "Shared
  with me" section). No prototype was needed — every design question resolved in
  conversation.
- Live Convex queries mean the Viewer's read-only view is automatically current;
  no extra sync work.
