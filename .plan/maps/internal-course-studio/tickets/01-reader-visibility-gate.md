---
type: task
blocked_by: []
---

# Reader-visibility gate (draft → publish)

## Question

**Where it stands:** open — no reader-visibility/draft state or publish/unpublish; lessons go live as authored

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Topic, Lesson, Reference, Owner, Viewer, Guest, Public link, Share). Spec: `../PRD.md`. Respects [ADR 0003](../../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons) and [ADR 0013](../../../../docs/adr/0013-public-link-shares.md) (Public link).

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

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no draft/visibility field on `topics` or `lessons`, no publish/unpublish mutation, and the Guest read seam (public.ts:57,169,212) serves content with no draft check — lessons go live as authored.

## Done when

Every acceptance criterion above holds with tests: draft by default, owner-only publish/unpublish, and Guests/Viewers served nothing at all while a Topic is draft.

<!-- Migrated 2026-07-30 from GitHub issue #73 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->
