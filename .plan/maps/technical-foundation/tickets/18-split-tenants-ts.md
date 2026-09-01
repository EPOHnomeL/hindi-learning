---
type: task
blocked_by: []
---
# Split `convex/tenants.ts`

## Question

`convex/tenants.ts` is **738 lines**, verified 2026-09-01, and it is the same shape of problem
as [16](16-empty-lib-ts.md): one file carrying tenant resolution, flags, seeding, theming and
admin surface together.

Named in the framing of `architecture-deepening/02` as needing "the equivalent split", then
left as an un-ticketed follow-up.

**One stale blocker, cleared.** That follow-up note said "Handoff A owns that file", which is
why nobody ticketed it. Checked 2026-09-01: `.plan/handoffs/` holds two files
(`2026-08-01-ywampotch-13-checkout-page.md` and
`2026-08-23-installable-app-implementation.md`) and **neither mentions `tenants.ts`**. There is
no live claim on this file, so the reason to defer is gone.

A concern worth carrying in: `tenants.ts` holds a `ponytail:` marker pointing at
`src/design/tokens.ts` as the intended single source of design tokens, which touches
[03](03-shadcn-foundation.md). Read that marker before deciding where the theming code lands.

## Done when

The concerns above have real module boundaries, no behaviour changes, `pnpm typecheck` and
`pnpm test` green. Same discipline as 16: small mechanical commits, moves separate from
changes.
