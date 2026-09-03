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
