# 02 — "Share with the company" entry point + draft-gating

Status: open — sharing mechanisms exist, but draft-gating (needs issue 01) is not built

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Share, Public link, Viewer, Guest, Topic). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0013](../../../docs/adr/0013-public-link-shares.md) (Public link mint/revoke semantics).

## What to build

A prominent **"share with the company"** entry point on a published course, surfacing the existing **Share** (by email) and **Public link** (anonymous) mechanisms — which are reused unchanged. Distribution is **blocked while the course is a draft**: a course can only be shared or made public once it has been published to readers (issue 01). End-to-end: owner publishes → shares (link or email) → an employee reads it.

## Acceptance criteria

- [ ] A published course shows a clear, non-buried "share with the company" action.
- [ ] A draft course cannot be shared by email or made public; the action is disabled in the UI **and** rejected server-side with a clear reason.
- [ ] Once published, the owner can mint / turn off / regenerate a Public link (existing behavior) and grant / revoke an email Share (existing behavior).
- [ ] A Guest opening a Public link for a course that is draft (or has been unpublished) gets "not available", never draft content.
- [ ] Tests: distribution mutations reject while draft and succeed once published; a Guest cannot reach content after the course is unpublished.

## Blocked by

- Issue **01** (reader-visibility state) — distribution gating keys off the published state.
