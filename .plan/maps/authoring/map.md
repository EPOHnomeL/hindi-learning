# Authoring: making, editing and organising a course

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Everything about **getting content into a course and keeping it right** lives in one
place: authoring it, editing it after the fact, giving it media, deciding who may see
it, and getting rid of it.

Chartered 2026-09-01 by gathering the authoring work scattered across six feature maps
(`course-authoring`, `course-management`, `internal-course-studio`, `rich-media`,
`media-generation`, `editing-obviousness`), during the consolidation that took `.plan`
from 33 map directories to 7 active maps.

Scope is fixed by one test: **does this change what a course contains, or who may
change it?** Authoring, editing, media, the draft/publish gate and deletion all pass.
How a course is *sold* is `distribution`; how it is *read* is `learning-experience`;
how it is *translated* is `translation-and-locales`.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. Tickets
  [02](tickets/02-streamline-routine-effort.md),
  [03](tickets/03-delete-button-for-courses.md),
  [04](tickets/04-reader-visibility-gate.md),
  [05](tickets/05-share-with-the-company.md),
  [07](tickets/07-walk-the-editing-affordances.md) and
  [08](tickets/08-editor-details-door.md) are execution. The grillings
  ([01](tickets/01-direct-course-editing.md), [06](tickets/06-video-and-audio-integration.md))
  are genuine open decisions.
- **Verify before reasoning.** Every claim below was checked in the tree on
  2026-09-01: `topics` carries no draft/visibility field (only `status`, which is the
  *authoring* lifecycle `seeded | active | completed`), and no delete mutation for a
  course exists anywhere in `convex/`. Re-check before acting; the tickets that came
  here were written between 2026-07-24 and 2026-08-31.
- **Manual editing already partly shipped, un-ticketed.** The closed
  [editing-obviousness](../authoring/assets/editing-obviousness-map.md) map's whole spec landed on
  2026-08-31 without tickets ever being cut: the always-visible Edit button, the
  accent-styled pencil, Resources open by default, lesson rename in the editor view
  (spec D10, which superseded D5's title-side pencil), and Reference editing on a
  translated Edition (spec D9). **Nobody has looked at any of it in a browser.**
  That is ticket [07](tickets/07-walk-the-editing-affordances.md), and it is the only
  thing between that spec and done. The spec itself is kept verbatim at
  [assets/editing-obviousness-spec.md](assets/editing-obviousness-spec.md).
  Ticket [01](tickets/01-direct-course-editing.md) must be re-read against what
  shipped before it is grilled, or it will re-decide settled things.
- **The video rail is already decided, elsewhere.** Mux is the product-wide video
  rail, and recording that ADR is
  [technical-foundation/15](../technical-foundation/tickets/15-adr-mux-as-the-video-rail.md).
  Ticket [06](tickets/06-video-and-audio-integration.md) is the merged product scope
  above it, not the rail choice; do not reopen the rail here.
- **Deletion has a consumer waiting.**
  [distribution/06](../distribution/tickets/06-share-management.md) needs the
  topic-delete share cascade, and it can only be built once
  [03](tickets/03-delete-button-for-courses.md) exists. That edge is cross-map, so it
  is prose here and not a `blocked_by` (which is map-local).
- Skills worth calling here: `grilling` for 01 and 06, `tdd` for 03 (a cascade over
  Entitlements and Certificates is exactly where a test-first habit pays), `ponytail`
  for 08, and `run` for the browser walk in 07.

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | Direct (manual) course editing | `course-authoring/02` |
| 02 | Streamline the routine's effort | `course-authoring/04` |
| 03 | Delete button for courses | `course-management/01` |
| 04 | Reader-visibility gate (draft to publish) | `internal-course-studio/01` |
| 05 | "Share with the company" and draft-gating | `internal-course-studio/02` |
| 06 | Video and audio integration | `rich-media/01` |
| 07 | Walk the shipped editing affordances | new: was the unmet half of `editing-obviousness`'s Destination, un-ticketed |
| 08 | Editor Details door on a translated Edition | `mobile-reader-todos/05` |

Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
donor maps. The old numbers remain those tickets' identity in their donor maps'
history, so **do not reuse them here**. Each moved ticket carries an HTML comment
footer naming where it came from.

Ticket 07 is the same failure the
[architecture-deepening](../architecture-deepening/map.md) map produced and
`technical-foundation` had to fix: a map's leftovers written as prose rather than a
ticket are on nobody's frontier. `editing-obviousness` shipped its entire spec and
recorded the outstanding browser walk in its Notes, where no derivation could see it.

## The dependency graph

One edge.

```
04 reader-visibility gate  ->  05 share with the company

frontier (7):  01 02 03 04 06 07 08
blocked   (1):  05
```

- **04 to 05**: 05 is the share entry point *plus* the refusal to distribute a draft.
  There is nothing to refuse until draft exists, and 04 is what mints it.

Cross-map, therefore prose and not an edge: `03` gates the cascade half of
[distribution/06](../distribution/tickets/06-share-management.md), and `01` should be
read against [assets/editing-obviousness-spec.md](assets/editing-obviousness-spec.md)
before it is grilled.

## Decisions so far

<!-- one line per resolved ticket -->

_(none yet: chartered 2026-09-01.)_

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. The test is whether the
     question can be phrased precisely now, not whether it can be answered now.
     Eight of these were tickets until 2026-09-01; their full bodies are kept at
     assets/deferred/ so re-cutting one costs a `git mv` and a number. -->

- **AI-assisted course editing**, an author changing a course by asking rather than by
  hand. Deferred because manual editing shipped first and its shape is now the ground
  truth any AI path has to respect (supersede, never mutate; ADR 0003 immutability).
  Body:
  [assets/deferred/ai-assisted-course-editing.md](assets/deferred/ai-assisted-course-editing.md).
  `clears-with: 01`
- **Self-serve course building**, a user generating, translating and selling their own
  course end to end. The largest speculative scope in the repo: it needs the
  who-may-build gate, metering, and a cost model that does not exist yet. Body:
  [assets/deferred/self-serve-course-building.md](assets/deferred/self-serve-course-building.md).
- **Copyright scanning** (`/scan-for-copyright`). The ticket itself said "deferred".
  Body: [assets/deferred/scan-for-copyright.md](assets/deferred/scan-for-copyright.md).
- **Folders and collections for the course list**, an at-scale organisation problem on
  a list that is not yet at scale, and the tenant model may already give most of it.
  Body: [assets/deferred/folders-and-collections.md](assets/deferred/folders-and-collections.md).
- **Course modules and per-module unlocking**, entangled with the learning-pyramid
  phases fog on [learning-experience](../learning-experience/map.md), and with
  CONTEXT.md, where "module" currently sits under Lesson's *Avoid*. Body:
  [assets/deferred/modules-and-per-module-unlocking.md](assets/deferred/modules-and-per-module-unlocking.md).
- **The course trailer** (a shareable promo video) and **course audio** (a
  NotebookLM-style podcast per Edition). Both were scope tickets with no committed
  intent, and both sit downstream of 06's media policy. Bodies:
  [assets/deferred/course-trailer.md](assets/deferred/course-trailer.md),
  [assets/deferred/course-audio.md](assets/deferred/course-audio.md).
  `clears-with: 06`
- **Book screenshots and direct references as lesson media.** The ticket's own
  question was whether 06 already covers it. Body:
  [assets/deferred/book-screenshots.md](assets/deferred/book-screenshots.md).
  `clears-with: 06`
- **What a course owner may hand to a co-author.** Ownership transfer and
  co-authorship is
  [technical-foundation/07](../technical-foundation/tickets/07-co-authorship-and-ownership-transfer.md)
  because the blocker is the data model (`topics.ownerId` is single-owner). What the
  *authoring surface* then offers is a question for this map, and it cannot be phrased
  until that one is answered.

## Out of scope

- **How a course is priced, sold or given away**: `distribution`.
- **How a course reads** to a learner, on any device: `learning-experience`.
- **Translation, Editions and locales**: `translation-and-locales`.
- **Which tenant may author at all.** The `seeding` flag, and every other switch, is
  [tenant-feature-modularity](../tenant-feature-modularity/map.md).
- **The Mux decision itself**: `technical-foundation/15` (see Notes).
- Anything inside an authored Lesson body beyond the head `<title>` splice a rename
  performs; body prose stays the pencil's job (carried over from
  `editing-obviousness`).
- **Deleting an individual Lesson.** `deleteLesson` already exists;
  [03](tickets/03-delete-button-for-courses.md) is about the whole course. Carried over
  from `course-management`.
- **Opening off-peak generation to ordinary owners.** The whole point of
  [technical-foundation/11](../technical-foundation/tickets/11-off-peak-course-generation.md)
  is that it stays admin-gated. Carried over from `course-authoring`.
- **Changing the teaching loop's shape.** ADR 0001 is a standing decision, not a ticket.
- **Translation itself.** The Edition machinery ships and is consumed here, never
  re-charted; `translation-and-locales` owns what is left of it.
- **A general-purpose plagiarism checker**, or anything rendering a legal judgement
  (carried over from the deferred copyright-scan scope).
- **Metering or billing on top of usage numbers.** Measurement only;
  [technical-foundation/12](../technical-foundation/tickets/12-cost-instrumentation.md) is
  the instrument, and what to charge is `distribution`. Carried over from
  `internal-course-studio`.
