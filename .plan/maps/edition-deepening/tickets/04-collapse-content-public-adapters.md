---
type: grilling
blocked_by: [01, 02, 03]
---

# Collapse content.ts / public.ts into one reader core + two adapters

## Question

The destination's final leg: make the authed reader (`content.ts`) and the Guest reader (`public.ts`)
**thin adapters over one shared reader core**, rather than two parallel query stacks.

**But grill the premise first — 01/02/03 may already have done most of this.** By the time this
graduated, the two readers already share `loadEdition` (01), `grantsFor` / `editionAccessLevel` (02),
`resolveEdition` vs `guestEditionFromToken` selection (03), plus `buildPaywall` and `lessonLocked`.
The parallel query trios (`getMap`/`publicCourse`, `getLesson`/`publicLesson`,
`getReference`/`publicReference`) may now differ only in (a) how the principal is resolved — authed
`resolveEdition` vs Guest token — and (b) `public.ts`'s **deliberate explicit output allowlist**
(anonymous, public-internet-facing: a Guest must never receive a field unless re-listed).

Design-in-ticket first (grill the interface), then TDD, then delete whatever parallel code the core
replaces.

Interface questions to grill:

- **Is there a real reader core left to extract, or is the collapse already substantively done?**
  Measure the actual remaining duplication between each `content.*` query and its `public.*` twin
  *after* 01–03. If it's just principal-resolution + row-shaping, a shared core may buy little.
- **What is the shared core's shape** — a function returning the common bundle (lessons/references/
  resources/progress/questions rows off `loadEdition(...).map()`), with each adapter supplying its
  principal and its output projection? Or is the honest unit smaller (per-artifact helpers) than a
  whole-course core?
- **Does the Guest's output allowlist survive the collapse intact?** The public safety property —
  no field reaches an anonymous Guest unless explicitly re-listed — must not be weakened by sharing a
  core with the authed reader. This likely keeps the *shaping* adapter-side even if fetching is shared.
- **Preserve exact behavior:** the paid-Edition preview gating (locked lessons, withheld
  resources/progress/Q&A on `preview`), the free-Edition full mirror, and the null-on-bad-token
  contract must be byte-for-byte unchanged.

**Wins (codebase-design):** leverage (two readers, one fetch core); locality (row shapes in one
place); the Guest path stops duplicating the fetch. **Risk to weigh:** collapsing across a security
boundary (the anonymous allowlist) can *cost* clarity — this ticket must decide whether the seam is
worth it or whether 01–03 already captured the real leverage and this leg closes as "adapters are
already thin."

Blocked by 01 (`loadEdition` projection) and 03 (`resolveEdition` seam named) — which in turn rides on 02.

## Done when

Whatever genuine reader duplication remains between the `content.*` queries and their `public.*` twins
after 01–03 lives in one shared core with both readers as thin adapters over it — or, where a shared core
would cost clarity (the Guest allowlist / full-mirror security boundary), that is explicitly ruled out and
kept adapter-side. Pure extraction, behavior byte-for-byte unchanged, `tsc` clean and the full convex suite green.

## Answer

Resolved 2026-07-22, commit `c89fb03` — reader core extracted; both readers now thin adapters.

**Finding: a real reader core remained, but a modest, per-artifact one — not a whole-course core.**
Reading both readers' query bodies side by side settled the ticket's own first question empirically:

- The parallel **`getLesson`/`publicLesson`** and **`getReference`/`publicReference`** bodies were
  **byte-for-byte identical after resolution** — same `loadEdition(...).lesson()`/`.reference()`, same
  lock gate, same locked-marker-vs-body return. The only difference was the resolution preamble
  (authed `resolveEdition` + `none`→not-found gate vs Guest token).
- The Guest's **`publicCourse`** full-mirror has **no authed twin** (the authed side splits that across
  `listLessons`/`listReferences`/a resources query/`capture.myQuestions`) and carries a deliberate
  **output allowlist** (anonymous safety). Collapsing across that security boundary would cost clarity
  for no dedup — **ruled out** (option C rejected).

**What landed (option A, behavior-preserving):**
1. **`readLesson(ctx, topic, lang, level, key)`** and **`readReference(...)`** in `lib.ts` — the
   null/locked/body payload for an already-resolved Edition. `getLesson`/`publicLesson` and
   `getReference`/`publicReference` are now **thin adapters**: resolve principal → call the core.
2. **`lessonsToc` / `referencesToc`** in `lib.ts` — the shared TOC mappings, used by
   `listLessons`/`listReferences` **and** the Guest's `publicCourse` (which stops inlining them).
3. The Guest allowlist + resources/progress/questions full-mirror stay **adapter-side, untouched**.

Pure extraction — content.ts −45 / public.ts −45 lines of parallel body absorbed into one core
(lib.ts +88). `tsc -p convex` clean; **full convex suite 459 tests green**. The two readers are now
adapters over a shared core, not parallel re-implementations — **the map's destination is reached.**
