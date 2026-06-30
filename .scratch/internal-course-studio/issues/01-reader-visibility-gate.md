# 01 — Reader-visibility gate (draft → publish)

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Reference, Owner, Viewer, Guest, Public link, Share). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons) and [ADR 0013](../../../docs/adr/0013-public-link-shares.md) (Public link).

## What to build

A Topic gains a **reader-visibility** state — `draft` (default) vs `published-to-readers` — separate from its `seeded | active` authoring lifecycle. The owner always sees their own draft course; **Viewers (Share) and Guests (Public link) see a Topic's Lessons and References only once it is published to readers.** The owner gets explicit "Publish to readers" and "Unpublish" actions and a clear draft/published indicator.

Prefactor first: route all Viewer/Guest content reads through a **single** query path so the visibility filter is applied in exactly one place, not scattered per surface. This is visibility only — Lessons are never edited (ADR 0003).

## Acceptance criteria

- [ ] A new/Seeded Topic defaults to `draft` reader-visibility, independent of `seeded | active`.
- [ ] The owner can read their entire draft course (Lessons + References, authored order).
- [ ] A Guest (by Public-link token) and a Viewer (by Share) receive **no** Lessons/References for a `draft` Topic.
- [ ] An owner-only "Publish to readers" mutation flips visibility; afterwards Guests/Viewers receive the content.
- [ ] An owner-only "Unpublish" mutation returns the course to `draft`; Guests/Viewers stop receiving content.
- [ ] Publish/unpublish mutations reject non-owners (owned-topic guard).
- [ ] The owner sees a draft/published indicator on the course.
- [ ] Read-seam tests: draft hidden from Guest + Viewer but visible to owner; published visible to all; unpublish hides again; non-owner mutation rejected.

## Blocked by

None - can start immediately.
