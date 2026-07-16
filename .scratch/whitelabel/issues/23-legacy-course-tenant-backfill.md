# whitelabel/23: Legacy course tenant backfill

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md), [11](11-ssr-theme-application.md),
[13](13-lesson-tenant-palette-override.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[01 — Resolution](01-scope-design-system-integration.md) decision 1;
[03 — implementation issue 9](03-scope-per-tenant-theming.md).

## Why

Both 01 and 03 explicitly called this out as a **downstream issue, not a v1 mechanism** — new
courses generated in a tenant's style get full palette fidelity baked in at publish; existing
pre-whitelabel courses only get the partial-fidelity 14-var override from 13 until they're
migrated. Not required for v1 correctness, but needed before an existing course looks fully
native on a tenant.

## Scope

- A migration script (follow the `scripts/*.ts` pattern, plain + `:prod` variants) that:
  - Assigns a `tenantSlug` to a chosen set of existing courses (operator-driven — which courses
    move to which tenant is a content decision, not something to infer automatically).
  - Re-bakes each course's stored HTML blob with that tenant's full palette (beyond the 14
    override vars 13 injects at render time), so legacy content reaches the same fidelity as a
    tenant-generated course.
- Pairs with (but does not require building) a "generate new courses in-style" authoring path —
  this issue only covers backfilling *existing* courses.

## Acceptance criteria

- Running the script against a chosen course + tenant slug sets `tenantSlug` and produces a
  re-baked blob visually matching the tenant's full palette (not just the 14-var override).
- Courses not selected for migration are untouched.
- Idempotent: running the script twice on the same course doesn't double-migrate or corrupt the
  blob.
