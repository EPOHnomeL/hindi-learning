---
type: task
blocked_by: [01, 03, 04]
---
# Build: flag storage for the grown inventory

## Question

Land the schema for every switch [01](01-the-tenant-switch-inventory.md) named, in the shape
[03](03-flag-storage-and-the-add-a-flag-rule.md) decided, with the default-site treatment
[04](04-is-the-default-site-switchable.md) picked. Nothing is gated yet and nothing is hidden yet;
this is the rail the rest of the map rides on.

Build test-first (`/tdd`) with a `/ponytail` posture. The three sync points are the known trap: the
validator in `convex/schema.ts`, the args object in `tenants.setTenantFlags`, and `FLAG_META` in
`AdminPanel.tsx` all list the keys by hand, and only `TenantFlag` is derived. Whatever 03 decided
about that, honour it here rather than adding a fourth hand-maintained list.

If 03 chose required booleans, this ticket is a **widen-migrate-narrow** against a live prod
deployment holding real tenant rows, not a single push. Sequence it as its own merges and use the
`PUBLISH_SECRET`-guarded `pnpm *:prod` CLIs for the backfill; Convex validates data on push, so a
narrowing schema deployed before the data carries the field will fail.

## Done when

- [ ] Every flag key from 01's Answer exists in `tenantFlagsValidator`, in the shape 03 decided,
      each with a comment saying what it gates.
- [ ] `setTenantFlags` accepts every new key, and its sys-admin gate is unchanged (05 moves it, not
      this ticket).
- [ ] Any dependency rule 01 landed on (parent off implies child reads off) is enforced in one
      place, with a test for the parent-off-child-on case.
- [ ] If 04 gave the apex a `tenants` row, the row is seeded and `assertTenantFlag`'s
      `undefined` early return is removed or kept exactly as 04 decided, with a test either way.
- [ ] Unknown-slug fail-closed still holds, pinned by the existing `tenantFlags.test.ts` case.
- [ ] If the shape is required booleans: the widen merge, the prod backfill, and the narrow merge
      are three separate steps, and the Answer records the date each landed.
- [ ] `pnpm typecheck` and the Convex suite are green.
