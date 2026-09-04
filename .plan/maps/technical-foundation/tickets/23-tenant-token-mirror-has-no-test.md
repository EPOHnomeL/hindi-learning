---
type: task
blocked_by: []
---
# The Convex tenant token mirror has no test holding it to the frontend

## Question

Filed 2026-09-03 out of [20](20-ponytail-debt-ledger.md), the ponytail debt harvest.
This is the one marker in that harvest whose **own stated trigger has already fired**.

The `ponytail:` marker at `convex/tenants.ts:16` says the frontend
`src/design/tokens.ts` is meant to be the single source of design tokens. That work
landed; `src/design/tokens.ts` exists and is canonical. But Convex cannot import from
`src/`, so the 14-token palette is **hand-mirrored** into `convex/tenants.ts` for the
SSR no-flash `<style>` and `getTheme`.

The two agree today. Nothing makes them keep agreeing:

- `convex/tenants.test.ts` checks the Convex copy.
- `src/design/tokens.test.ts` checks the frontend copy.
- **Neither compares the two.** Each test would stay green while the palettes drifted
  apart, and the symptom would be a colour flash or a wrong brand colour on first paint
  for a freshly created tenant, which is exactly the failure the mirror exists to
  prevent.

The harvest's judgement was that this is one test, not a refactor. A shared source that
both sides import is the tempting fix and is probably not worth it: the Convex runtime
boundary is the reason the duplication exists, and a test that fails loudly on drift buys
most of the safety for a fraction of the work. Take the lazy option unless the test turns
out to be awkward to write.

## Done when

A test fails when the Convex mirror and `src/design/tokens.ts` disagree, and the marker
at `convex/tenants.ts:16` is updated to point at that test rather than at an unfired
trigger.

## Answer

Resolved 2026-09-04. **The two lists agreed when I looked**, byte for byte, and so did the
default palette. No live drift, so nothing was silently fixed under cover of the test.

### Where the file actually is

The ticket's `convex/tenants.ts:16` is stale. [18](18-split-tenants-ts.md) split `tenants.ts`
earlier on 2026-09-04 and the mirror now lives in **`convex/tenantTheme.ts`**, marker at line 20,
`TENANT_THEME_TOKENS` at 23. The list itself was unchanged by that move.

### The test

Two assertions appended to the existing **`src/design/tokens.test.ts`**, not a new parallel file.
It runs in the node environment and imports `../../convex/tenantTheme` directly, which works:
a *test* can cross the runtime boundary a Convex *function* cannot, and that is the whole trick
that makes the lazy fix possible. No shared module, no refactor. The duplication stays, because
the runtime boundary is the reason it exists.

1. `convex/tenantTheme.ts` TENANT_THEME_TOKENS deep-equals `src/design/tokens.ts`
   TENANT_THEME_TOKENS, order included.
2. `DEFAULT_TENANT_THEME.light` deep-equals the light-mode `--color-*` values parsed out of the
   `@theme` block of `src/styles/globals.css`.

Both failure messages name which side is canonical and say to edit the Convex copy, so whoever
trips this in six months does not have to reconstruct the intent.

### DEFAULT_TENANT_THEME is covered too, deliberately

The ticket only named the token list, but `DEFAULT_TENANT_THEME` sits directly below it and is a
**second hand mirror**, of `src/styles/globals.css` rather than of `tokens.ts`. It can drift in
exactly the same silent way, and its blast radius is the same one the ticket describes: a freshly
created tenant renders the house default palette until an operator paints the real brand, so a
drifted default is a wrong colour on first paint. One more assertion in the same file was
cheaper than leaving the second mirror unguarded, so it is covered.

### The test was proved to fail

Both assertions were made red on purpose before being trusted: the Convex copy was temporarily
perturbed in the working tree (`bad-b` renamed to `bad-bb`, and `paper` set to `#ff0000`), the
suite went to 2 failed / 9 passed with the intended diffs and messages, and the perturbation was
reverted to a clean `git diff`. A drift test that cannot fail reads as coverage while providing
none.

### Evidence

`pnpm typecheck` clean and `pnpm vitest run` green: **87 files, 1047 tests**, up from the 1045
baseline by exactly the two assertions added. The evidence is a green typecheck and suite, **not**
a browser walk: the failure this guards against is a source-level disagreement between two files,
which is the kind of thing a test sees better than an eye does.

The `ponytail:` marker at `convex/tenantTheme.ts:20` now points at the test rather than at the
already-fired trigger, and the row in `docs/ponytail-debt.md` moved from NEEDS A TICKET to
ACCEPTED, covered by a test.
