---
type: task
blocked_by: []
---

# Publish lifecycle (`topics.status`)

## Question

Publish is the owner action that lists a course in its tenant catalogue. The decision
([ticket 03](03-define-publish-action.md)): **`published` is a course lifecycle *status*, not an
orthogonal flag** — it folds into the existing authoring spine (`seeded | active | completed`) and
structurally freezes the lesson count.

Scope:
- **Schema** (`convex/schema.ts:117`) — extend the `status` union with a fourth literal `published`.
  A backward-compatible **widening**; existing rows already hold a valid value or `undefined`, so **no
  data migration**.
- **Mutations** (`convex/content.ts`, beside `endCourse`/`reopenCourse` at `content.ts:584`),
  **owner-only** via the `getOwnedTopic` gate: `publishCourse({ topicSlug })` requires
  `status === "completed"` → `published`; `unpublishCourse({ topicSlug })` requires `published` →
  `completed` (existing `enrollments` grandfather, not deleted); guard `reopenCourse` so a `published`
  course must be unpublished first. Keep the machine tight: `active ⇄ completed ⇄ published`.
- **Authoring gate** — the Routine today refuses `completed` (`routine.ts` `acquireWork`/`finishProvider`
  guards). Extend every such guard to **also refuse `published`** (content stays frozen). Grep
  `"completed"` in `convex/routine.ts` and `convex/content.ts` and treat `published` identically
  wherever `completed` means "authoring done / frozen".
- **Client-facing status** — `content.courseHeader.status` (`content.ts:633`) widens to include
  `v.literal("published")`.
- **Pricing gate — call to make:** `setEditionPrice` requires `status === "completed"`
  (`market.ts:57`). Keeping it strict strands an owner who wants to add/adjust a price on an
  already-published mixed course. **Widen the gate to `completed || published`** (both content-frozen;
  the catalogue explicitly supports priced published courses). Do it here with a test; note it in the
  resolution — don't silently leave the friction.
- **Explicitly NOT gated on publish:** `startCheckout` (`market.ts:386`) — a priced Edition stays
  buyable via direct link whether or not it's listed.

Tests (write first): `publishCourse` owner+`completed`→`published`, owner+`active`/`seeded` throws,
non-owner throws; `unpublishCourse` owner+`published`→`completed`, enrollments survive, non-owner
throws; the Routine refuses a `published` course; `setEditionPrice` succeeds on `published` (widened
gate) and still throws on `active`; `startCheckout` works on a priced Edition regardless of publish.

## Done when

Typecheck / codegen clean; existing status tests green; the five test groups pass; no authoring fires
on a published course; `courseHeader` reports `published`.

## Answer

Shipped, but **at a different grain than this ticket specced** (build 2026-07-28; decision of record
`docs/adr/0024-publish-at-the-edition-grain.md`). Publishing landed as a per-**Edition**
`publishedEditions` row `{ topicId, lang, published }`, **not** a fourth `topics.status` value:

- `topics.status` was left untouched — no `published` literal, no state-machine change.
- No Routine-gate change and **no `setEditionPrice` gate widening** — because publishing is off the
  status/authoring axis, the friction that motivated widening the gate doesn't exist. An owner can
  list English while Spanish is still in proofing, and can list a course that is still `active`.
- **Owner-only publish reaffirmed** (§3 of ticket 03; reconsidered during the build, original answer
  stands). Publish remains catalogue **visibility only, not an acquisition gate** — `startCheckout`
  stays un-gated on publish; for a free published Edition there is no acquisition step at all (it
  reads ≡ a Viewer for any signed-in account — see [issue 13](13-self-enroll-mutation.md)).

**Unblocks:** 13, 14.
