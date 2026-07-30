---
type: grilling
blocked_by: [02]
---

# Fold the Edition-selection resolvers — one `resolveEdition` over a principal

## Question

The PRD claims "access resolves at one seam," but selection and classification interleave across four functions with
subtly different fallback rules: the authed reader threads `readableLang` → `resolveReaderEdition` →
`editionAccessLevel` (`convex/lib.ts`), the Guest reader has its own `resolveGuestEdition` (`convex/public.ts`), and
`capture.myQuestions` calls `readableLang` raw.

**Design-in-ticket first** (grill the interface), then TDD, then delete the folded functions.

Interface questions to grill:

- The **principal** abstraction: `resolveEdition(ctx, topic, principal, requested) → { lang, level }`, where
  `principal` is either an authed `userId` or a public-token grant. Is "principal" the right seam, or should the
  Guest grant be passed differently? The Guest becomes **one adapter** of the principal, not a parallel stack.
- Unify the requested-vs-held fallback precedence that's currently split across `resolveReaderEdition` (owner path,
  specific-request path, request-less path) and `resolveGuestEdition`. Preserve today's exact behaviour: a specific
  paid-Edition request shows *that* Edition's Preview (never a silent redirect to a held Edition); request-less falls
  back through held → English → deterministic.
- How it consumes ticket 02's `grantsFor` (this composes over the grant resolver — hence the dependency).
- What `capture.myQuestions` and the two course-header queries call instead.

**Two adapters (authed / Guest) justify the seam** — a real seam, not a hypothetical one.

**Wins (codebase-design):** leverage (two readers, one resolver); locality (fallback precedence in one place); the
Guest path stops duplicating the shape.

Blocked by ticket 02 — `resolveReaderEdition` already computes `grantsFor` once and threads it; the selection fold
composes over that resolver. Together with ticket 01 it unblocks the fogged content/public collapse (map Not yet
specified).

## Done when

Edition selection+classification is named and lives at one authed seam with the Guest path a documented exception:
either the `principal` union lands as a real seam, or (if grilling shows it hypothetical) the seam is ratified and
named without inventing a never-firing ladder — behaviour byte-for-byte preserved, `tsc` clean and the
reader/access suite green.

## Answer

Resolved 2026-07-22, commit `a1e4357`, as "already folded by 01+02; ratified + named."

**Finding: the fold this ticket set out to do was already achieved by tickets 01 and 02.**
Grilling the interface against the actual code (design-in-ticket) collapsed the premise:

- **The `principal` union is a hypothetical seam, not a real one — rejected.** The Guest reader
  does **no Edition selection**: its Public-link token fixes *both* topic and lang in one lookup
  (`guestEditionFromToken`, formerly the private `resolveEdition(token)`), then classifies via the
  **already-shared** `editionAccessLevel`. Routing the Guest through `resolveEdition(topic, principal,
  requested)` would invent a `requested` that is always the token-lang and a fallback ladder that can
  never fire — the exact "hypothetical seam" the ticket warned against. So the Guest stays a thin
  token adapter over the shared classifier; it is **not** dragged through a `principal` abstraction.
- **`capture.myQuestions` stays on `readableLang`.** It needs the **null-when-nothing-held** signal
  (→ returns `[]`); the reader seam deliberately never returns null (unheld-paid → `preview`). These
  are two different needs, so `readableLang` remains the exported selection *primitive* that the seam
  is built on — capture calls it directly rather than re-deriving "no access" from `level === "none"`.
- **The "four functions with subtly different fallback rules" turned out not to be duplicated.**
  `resolveEdition`'s request-vs-held ladder and `readableLang`'s held→English→deterministic fallback
  are two *distinct* concerns, each already living in exactly one place after ticket 02 threaded
  `grantsFor` once. There was no repeated fallback logic left to unify.

**What actually landed (behavior-preserving, per the user's "don't break anything" constraint):**
1. `resolveReaderEdition` → **`resolveEdition`** (the map's canonical seam name), with a doc comment
   naming it as THE authed selection+classification seam and pointing at the two intentional
   exceptions (Guest token adapter; capture's `readableLang`).
2. `public.ts`'s private `resolveEdition(token)` → **`guestEditionFromToken`** (frees the name, kills
   the collision, documents the Guest-has-no-ladder distinction).

Pure rename + comments — **zero behavior change**. `tsc -p convex` clean; **102 reader/access tests
green** (content / public / edition-reader / enrollment / market / translate / sharing-readonly).

Leg 3 of the map's destination is satisfied. The fogged **content/public collapse** (map *Not yet
specified*) is now unblocked → graduated to **[ticket 04](04-collapse-content-public-adapters.md)**.
