# course-publishing/10: Publish lifecycle (`topics.status`)

**Status:** ready-for-agent
**Depends on:** —
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 03](03-define-publish-action.md).

## Why

Publish is the owner action that lists a course in its tenant catalogue. The decision: **`published`
is a course lifecycle *status*, not an orthogonal flag** — it folds into the existing authoring spine
(`seeded | active | completed`) and structurally freezes the lesson count.

## Scope

**Schema** (`convex/schema.ts:117`) — extend the `status` union with a fourth literal. This is a
backward-compatible **widening**; existing rows already hold a valid value or `undefined`, so **no
data migration**:

```ts
status: v.optional(v.union(
  v.literal("seeded"), v.literal("active"), v.literal("completed"), v.literal("published"),
)),
```

**Mutations** (`convex/content.ts`, beside `endCourse`/`reopenCourse` at `content.ts:584`) —
**owner-only** (a Viewer/editor is refused by the `getOwnedTopic` gate):

- `publishCourse({ topicSlug })` — requires `status === "completed"`; patches → `published`. Throws
  otherwise (only a completed course can be published).
- `unpublishCourse({ topicSlug })` — requires `status === "published"`; patches → `completed`. Existing
  `enrollments` **grandfather** (they are not deleted — a later re-publish just re-lists).
- `reopenCourse` (existing) stays `completed → active`; guard it so a `published` course must be
  unpublished first (or, minimally, refuse `reopen` when `published`). Keep the state machine tight:
  `active ⇄ completed ⇄ published`.

**Authoring gate** — the Routine today refuses to author a `completed` course (`routine.ts` — the
`acquireWork`/`finishProvider` guards checking `status === "completed"`). Extend every such guard to
**also refuse `published`** (content stays frozen once published). Grep `"completed"` in
`convex/routine.ts` and `convex/content.ts` and treat `published` identically wherever `completed`
means "authoring is done / frozen".

**Client-facing status** — `content.courseHeader.status` union (`content.ts:633`) widens to include
`v.literal("published")` so the reader can show the owner's Unpublish control and hide "Generate next
lesson".

**Pricing gate — call to make.** `setEditionPrice` requires `status === "completed"` (`market.ts:57`).
Ticket 03's sequence is price-while-`completed`-then-publish, but keeping the gate strict strands an
owner who wants to add/adjust a price on an already-**published** mixed course (forcing
unpublish→price→republish). **Widen the gate to `status === "completed" || status === "published"`**
(both content-frozen; nothing in the decisions forbids pricing a published course, and the catalogue
explicitly supports priced published courses). Do this here (it's a status-semantics change), with a
test, and note it in the resolution comment — don't silently leave the friction.

**Explicitly NOT gated on publish:** `startCheckout` (`market.ts:386`) — a priced Edition stays
buyable via direct link whether or not it's listed (ticket 03: publish = catalogue visibility, not an
acquisition gate). The public link and `listings` sit beside publish, unchanged.

## Tests (write first)

- `publishCourse`: owner + `completed` → `published`; owner + `active`/`seeded` throws; non-owner throws.
- `unpublishCourse`: owner + `published` → `completed`; enrollments survive; non-owner throws.
- The Routine's authoring gate refuses a `published` course (no lesson authored).
- `setEditionPrice` succeeds on a `published` course (the widened gate); still throws on `active`.
- `startCheckout` on a priced Edition works regardless of `published` (unlisted-but-buyable).

## Acceptance criteria

- Typecheck / codegen clean; existing status tests green.
- The five test groups above pass.
- No authoring fires on a published course; `courseHeader` reports `published`.

**Unblocks:** 13, 14.
