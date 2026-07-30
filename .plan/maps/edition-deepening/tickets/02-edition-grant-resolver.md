---
type: grilling
blocked_by: []
---

# The Edition grant resolver — `grantsFor`

## Question

ADR-0023's `enrolled` primitive landed correctly but as a **third copy** of the same grant-shaped read. Adding a grant
type today means four lock-step edits in `convex/lib.ts`: a new `*Langs` helper, a branch in `heldLangs`, a check in
`editionAccessLevel`, and the `EditionAccess` union. `viewerLangs` / `entitledLangs` / `enrolledLangs` are near-
identical (query `by_topic_user` → map a `lang` field → Set), and both `heldLangs` **and** `editionAccessLevel` walk
all three independently.

**Design-in-ticket first** (grill the interface), then TDD, then delete the collapsed helpers.

Interface questions to grill:

- The resolver shape: `grantsFor(ctx, topic, userId) → Map<lang, "viewer"|"entitled"|"enrolled">` (keeps provenance) —
  or a different return? How does the **owner** case fit (owner holds source + every ready translation — not a
  table-row grant)? Keep owner separate, or model it as a synthetic grant?
- Precedence when a caller holds a lang via more than one grant (e.g. a Share **and** an Entitlement on the same
  Edition) — which kind wins, and does it matter to any caller? Today `editionAccessLevel` checks viewer → entitled →
  enrolled in order; preserve that.
- How `heldLangs` reads it (the key set) and how `editionAccessLevel` reads it (the value for one lang) — one walk,
  consumed two ways, so the three table reads happen **once**, not twice.
- The single point where the **table list** lives, so adding a grant type is one row there and nothing else.

**Not a table merge** — `shares`/`entitlements`/`enrollments` stay distinct (ADR-0023, see map Out of scope). This
deepens the *read* over them, not the storage.

**Wins (codebase-design):** locality (grant rules concentrate in one walk); leverage (adding a grant type closes
under one interface); collapses three near-identical `*Langs` helpers; one place to test precedence; provenance kept
rather than thrown away then re-queried by `editionAccessLevel`.

Independent of ticket 01. Blocks ticket 03 (the selection fold composes over this resolver).

## Done when

`grantsFor(ctx, topicId, userId) → Map<lang, Grant>` is the single three-table grant walk: `viewerLangs`/
`entitledLangs`/`enrolledLangs` are deleted, `heldLangs`/`editionAccessLevel`/`readableLang` read the one map
(consumed two ways, read once per request), precedence viewer > entitled > enrolled is preserved with zero behaviour
change, and adding a grant type is one collect block + one union member — verified by new precedence/provenance tests
with the full suite and typecheck green.

## Answer

Grilled 2026-07-20, HITL. Landed as tested code — commit `7a2c5a3`. `grantsFor` + `Grant` added,
`viewerLangs`/`entitledLangs`/`enrolledLangs` deleted, consumers threaded, 10 new
`grant-resolver.test.ts` cases green, full suite 429/429, typecheck clean, Convex
reviewer clean (contract note + collision tests added on its suggestion).

**Interface**

```ts
export type Grant = "viewer" | "entitled" | "enrolled";

// The three-table grant walk — the ONE place shares/entitlements/enrollments
// are read for a caller. Provenance kept; precedence viewer > entitled > enrolled
// (matches today's editionAccessLevel first-match order). Owner is NOT a grant
// type (owner langs come from translationJobs) — resolved by the callers.
export async function grantsFor(
  ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">,
): Promise<Map<string, Grant>>;
```

**Decisions (each a grilled fork)**

1. **Owner kept separate.** `grantsFor` walks only the three grant tables. The
   owner branch stays in `heldLangs` (SOURCE_LANG + READY `translationJobs`) and
   `editionAccessLevel` (`"owner"` short-circuit). Owner isn't a grant type, so
   the "add a grant type = one edit" win applies cleanly to the walk.
2. **Precedence preserved: viewer > entitled > enrolled.** Built into walk order:
   shares `set` unconditionally, entitlements/enrollments `set` only if the lang is
   absent. Same badge a user sees today, now decided in one place. Zero behaviour
   change.
3. **Three explicit collects in one fn** (not a data-driven source array). Convex's
   typed `withIndex` ties index/field names to string literals, and `shares` diverges
   (index `by_topic_viewer` + `viewerId` + `shareLang()` legacy helper) from
   entitlements/enrollments (`by_topic_user` + `userId` + plain `.lang`). Adding a
   grant type = one more collect block + one union member, both inside `grantsFor`.
4. **Thread compute-once now** (not deferred to ticket 03). `heldLangs`,
   `editionAccessLevel`, and `readableLang` each gain a trailing optional
   `grants?: Map<string, Grant>` param — computed internally via `grantsFor` when
   omitted (keeps single-shot callers in content/market/public/capture/certificates
   unchanged), threaded when provided. `resolveReaderEdition` computes it **once**
   per request (`topic.ownerId === userId ? undefined : await grantsFor(...)`;
   owner short-circuits before touching it, so no wasted read) and passes it to
   every `readableLang`/`editionAccessLevel` call — collapsing 2–4 grant walks per
   resolution into one.

**Lands as**

- New: `Grant` type + `grantsFor` in `convex/lib.ts` (Editions region).
- Rewire: `heldLangs` non-owner branch → `grants.keys()`; `editionAccessLevel`
  non-owner branch → `grants.get(lang)`; `readableLang` + `resolveReaderEdition`
  thread the param.
- Delete: `viewerLangs`, `entitledLangs`, `enrolledLangs` (internal to `lib.ts`,
  no external callers).
- Tests: `grantsFor` unit (precedence, provenance, empty, legacy no-lang share);
  existing `enrollment.test.ts` (heldLangs/editionAccessLevel) stays green.
