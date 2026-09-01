---
type: task
blocked_by: []
---

# Reader-visibility gate (draft → publish)

## Question

**Where it stands (corrected 2026-08-18):** open, but **not for the reason stated below.** A
publish/unpublish gate *does* now exist — at the Edition grain, for the tenant catalogue
(ADR 0024, built 2026-07-28). What is still missing is the part this ticket actually cares about:
the **Share/Guest read gate**. See "What ADR 0024 did and did not settle" below.

~~no reader-visibility/draft state or publish/unpublish; lessons go live as authored~~

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Topic, Lesson, Reference, Owner, Viewer, Guest, Public link, Share). Spec: `../PRD.md`. Respects [ADR 0003](../../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons) and [ADR 0013](../../../../docs/adr/0013-public-link-shares.md) (Public link).

## What to build

A Topic gains a **reader-visibility** state — `draft` (default) vs `published-to-readers` — separate from its `seeded | active` authoring lifecycle. The owner always sees their own draft course; **Viewers (Share) and Guests (Public link) see a Topic's Lessons and References only once it is published to readers.** The owner gets explicit "Publish to readers" and "Unpublish" actions and a clear draft/published indicator.

Prefactor first: route all Viewer/Guest content reads through a **single** query path so the visibility filter is applied in exactly one place, not scattered per surface. This is visibility only — Lessons are never edited (ADR 0003).

## What ADR 0024 did and did not settle (2026-08-18, verified in the tree)

Re-verified on `main` @ `bf04257`. The 2026-07-10 comment below is now half-stale, and the stale
half is the one that reads as "nothing exists":

- **Settled.** Publishing shipped as a `publishedEditions` row — a `published` boolean per
  `(Topic, language)`, owner-only to write (`convex/schema.ts:533`,
  [ADR 0024](../../../../docs/adr/0024-publish-at-the-edition-grain.md)), with publish *and*
  unpublish. So "no publish/unpublish" is false, and "a draft/published indicator" partly exists.
  Note the grain differs from what this ticket assumed: **per Edition, not per Topic**, and there
  is no `topics.status` visibility value.
- **Not settled — the whole point of this ticket.** `publishedEditions` gates the **catalogue**
  and nothing else. The only reader of it is the catalogue helper at `convex/lib.ts:236-243`. A
  **Viewer** (via `shares`) and a **Guest** (via `publicLinks`) still receive Lessons and
  References with no publish check whatsoever, exactly as the 2026-07-10 comment described. An
  unpublished Edition is unlisted, not unreadable.

**Consequence for whoever works this:** the ticket is now "extend the existing Edition-grain
publish state to gate the Share and Guest read seams", not "invent a visibility state". Two
questions the acceptance criteria below do not answer, and should be answered first:

1. **Does the gate stay at the Edition grain** (composing with `publishedEditions`) or does it
   want the Topic-grain draft state written below? Two visibility states would be the bug factory
   the map's Notes warn about, and the map's "one gate, not two" instruction now cuts against
   ADR 0024 as well as against course-authoring 01.
2. **Is unlisted-but-shareable deliberate?** An owner can currently share a *draft* Edition by
   link and the recipient reads it. That may be a feature (private review before listing) rather
   than the defect this ticket assumes.

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

<!-- Moved 2026-09-01 from `internal-course-studio/01` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. -->
