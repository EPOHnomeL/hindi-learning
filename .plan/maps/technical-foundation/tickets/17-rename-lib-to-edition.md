---
type: task
blocked_by: [16]
---
# Rename `lib.ts` to `edition.ts`

## Question

Once [16](16-empty-lib-ts.md) has emptied it, `convex/lib.ts` holds one thing: the Edition
reader, the grant resolver and the paywall. At that point the name `lib` actively misleads,
and the rename is a one-line-per-import mechanical change across **16 sites**, verified by
grep on 2026-09-03. The "32" this line used to carry was never quite right and is now well
out of date: ticket 16 counted 33 `from "./lib"` import statements before it started (three
of the ticket's 32 were prose mentions in comments, not imports) and left 16 behind when it
finished. Emptying the file halved the rename.

**This is deliberately its own ticket, and deliberately blocked.** The
[architecture-deepening](../../architecture-deepening/map.md) map recorded the rename as
**declined until the file is emptied**, on the grounds that renaming a junk drawer to
`edition.ts` while it still hosts `assertAdmin`, `mintToken` and the share helpers would
misname it more precisely than `lib` does. That reasoning still holds, and the edge on this
ticket is what enforces it.

## Done when

`convex/edition.ts` exists, `convex/lib.ts` does not, every import site is updated, and
`pnpm typecheck` and `pnpm test` are green. One commit, no behaviour change.
