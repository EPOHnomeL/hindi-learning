# rich-media/10: Scope AI linking into course Resources

**Status:** resolved (2026-07-19) — scoped, ready for a PRD/build ticket
**Depends on:** none (whole-resource links only; video-timestamp anchors deferred to ride on 04)

## Why

"Add a way for the AI to link directly to the resources in the course" (note resolved
2026-07-15). The teach skill's citation rule points at *external* URLs today, while the
learner's own uploaded [[Resource]]s — the trusted sources teaching is grounded in — are only
reachable as whole files from the sidebar. A lesson should be able to say "see the Handbook"
and take the reader straight to that Resource.

## Resolution

Scoped as **whole-resource [[Resource link]]s** (open the Resource, learner browses it). No
page or timestamp precision. Video-timestamp deep-links stay deferred to ride on ticket 04
(transcript ingestion); PDF page anchors were also considered and cut for the leanest first cut.

### Decisions

1. **Depth — whole-resource only.** Links open the Resource; no `#page=` / `#t=` anchors.
2. **Stable-URL mechanism — reader-resolved id route.** Lesson HTML carries the stable
   `/courses/<slug>/resources/<id>` route, never a signed URL (which expires; lessons are
   immutable). The reader resolves `id` → a fresh signed url from the Resource list it
   **already holds in-bundle** — [`listResources`](../../../convex/resources.ts#L252) for the
   owner/[[Viewer]], [`publicEdition`](../../../convex/public.ts#L142) for a [[Guest]]. No new
   backend route; no new bearer exposure. (Rejected: serving Resource blobs over a
   `/content`-style storageId capability — makes blobs bearer-public to anyone holding the
   lesson HTML, and is more machinery.)
3. **Click behaviour — sidebar parity.** The interceptor does exactly what
   [`ResourceItem`](../../../src/app/_components/ResourceItem.tsx#L59) does: new tab for a
   PDF/external URL, the Markdown dialog for a `.md`. No dedicated in-reader resource view.
4. **Authoring knowledge — ready-made path.** `materialise` adds both `id` and a precomputed
   `readerPath` (`/courses/<slug>/resources/<id>`) to each `resources/_index.json` entry (and
   the `materialiseTopic` payload). The AI copies the opaque path **verbatim** — a hand-typed
   template on an opaque id is exactly where an AI slips.
5. **Access — graceful no-op.** Owner/[[Viewer]] and free-Topic [[Guest]]s already receive
   Resource urls in-bundle (**overturns the original ticket's assumption that the Guest seam
   didn't cover Resources** — [`public.ts`](../../../convex/public.ts#L142) does). On a paid
   [[Edition]] [[Preview]] the `id` is withheld by design (`resources: preview ? [] :
   resources`); a click whose `id` isn't in the reader's bundle (withheld, or a since-deleted
   Resource) simply does nothing — no navigation, no error, no publish-time stripping.
6. **Translations — zero work.** The translate prompt preserves every attribute exactly
   ([`translate.ts`](../../../convex/translate.ts#L527)), so the href is untouched; Resources
   are Topic-scoped, so the same `id` resolves across all Editions.
7. **Authoring guidance — reuse `.cite`.** A Resource link reuses the existing `.cite` + `<a>`
   citation convention (no new class or icon). SKILL.md §Knowledge and AUTHORING.md §6 are
   updated to steer the skill to cite the **owned Resource** (its reader route) whenever a
   claim is grounded in one, keeping external-URL citations for out-of-workspace claims.

## Build surface

- `scripts/materialise.ts` — add `id` + `readerPath` to `resources/_index.json`.
- `materialiseTopic` payload in `convex/routine.ts` — expose the Resource `id`.
- Reader lesson-body click interceptor — extend the
  [`internalNavTarget`](../../../src/app/_components/readerDerive.ts#L68) seam to recognise a
  `/courses/<slug>/resources/<id>` target and **open the Resource** (sidebar parity) rather
  than navigate; graceful no-op when the `id` isn't in-bundle.
- `.claude/skills/teach/AUTHORING.md` (§5 routes, §6 grounding) and `SKILL.md` (§Knowledge).
- **Unchanged:** `convex/public.ts`, `convex/resources.ts`, `convex/translate.ts`.

## Out of scope

- Page/timestamp fragment anchors (`#page=`, `#t=`) — whole-resource links only this cut.
- Embedding Resource *content* inside lessons (rich-media/02) — this is linking, not embedding.
- Transcript ingestion (04) and video-anchored teach mode (07).

## Deliverable

Scoped above. Ready to fold into a rich-media PRD or lift straight into an implementation ticket.
