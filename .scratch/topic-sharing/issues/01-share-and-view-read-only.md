# 01 — Share a Topic and open it read-only (tracer bullet)

Status: done — shipped 0898055 (shares relation, owner-or-Viewer getViewableTopic, Shared-with-me section)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

## Want

The thinnest end-to-end sharing slice: an owner shares a Topic to another
existing User by email, and that **Viewer** sees it in a "Shared with me"
section and opens it into the read-only Reader, reading the Topic's Lessons and
References. This stands up the spine — the `shares` relation and the read-gate
widening — that every later slice builds on.

## Acceptance

- A new `shares` relation records that one Viewer has read-only access to one
  Topic, keyed for both lookups: by Topic (who can view this) and by Viewer
  (what's shared with me). A Topic may carry many Shares.
- `shareTopic` takes a recipient email, resolves it against `users`, and creates
  a Share only if that account exists. (Edge cases — self-share, duplicate,
  no-account — are **06**; the happy path is here.)
- A read-resolver grants Topic access when the caller is the **owner or a
  Viewer**, as a sibling to the owner-only [`getOwnedTopic`](../../../convex/lib.ts).
  The Lesson/Reference read queries move onto it; **write paths stay owner-only**.
- A `listSharedTopics` query returns the Topics shared **with** the caller.
- The owner's course card gains a "Share" affordance (add-by-email is enough for
  this slice; list/revoke is **06**).
- A "Shared with me" section renders below the owner's own course grid: cards
  attributed to the owner, **without** Edit/Share controls, opening the existing
  read-only Reader showing Lessons + References. View updates live.

## Depends on

- Nothing (foundation).

## Notes

- Lessons/References have no learner writes, so they are read-only for free here.
  Resources, Mission, Questions, and Progress get their own read + write-block
  slices (**02–05**).
- Covers PRD stories 1, 2, 10, 11, 12, 13, 14, 18, and the re-share/rename block
  of 23 (shared cards expose no such controls).
