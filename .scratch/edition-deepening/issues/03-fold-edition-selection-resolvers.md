# edition-deepening/03: Fold the Edition-selection resolvers — one `resolveEdition` over a principal

**Status:** open — now the sole frontier (02 landed in `7a2c5a3`)
**Labels:** wayfinder:grilling
**Depends on:** 02 (DONE) — `resolveReaderEdition` already computes `grantsFor` once
and threads it; the selection fold now composes over that resolver.
**Parent:** [00 — Edition surface deepening map](00-edition-deepening-map.md)

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

Blocked by ticket 02. Together with ticket 01 it unblocks the fogged content/public collapse (map Not yet specified).
