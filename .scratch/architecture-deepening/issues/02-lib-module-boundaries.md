# architecture-deepening/02: Give lib.ts's sections real module boundaries

**Status:** open
**Labels:** ready-for-agent

## Why

`convex/lib.ts` (732 lines) is turning into a kitchen-sink module. Every edition-deepening ticket
added another section to the same file instead of a module: content-blob URL building
(`lib.ts:83-116`), tenant flag gating (`124-149`), topic resolvers (`151-226`), the whole Edition
grant/access/paygate stack (`228-654` — `loadEdition`, `grantsFor`, `resolveEdition`,
`readLesson`/`readReference`, the genuinely deep part built across four edition-deepening
tickets), title translation (`656-673`), Seller status (`516-556`), and progress counts
(`714-732`). No sub-module boundary exists — just section-header comments.

Deletion test: deleting the Seller-status block or the tenant-flag block wouldn't touch the
Edition-access code at all — these are unrelated concerns cohabiting one file by convention, not
by design. `convex/tenants.ts` (607 lines) shows the same pattern (seed/theme/logo/favicon/
admin-membership all in one file) — worth checking whether this ticket's approach extends there
too, once the shape is proven on `lib.ts`.

## Scope

- Keep the Edition-access deep module (`loadEdition`, `grantsFor`, `resolveEdition`,
  `readLesson`/`referenceToc`/etc.) in `lib.ts` (or rename to `edition.ts` if that reads better
  against `CONTEXT.md`'s Edition vocabulary — grill this before committing to a name).
- Move tenant-flag gating (`assertTenantFlag` and friends) to its own file (e.g. `tenantFlags.ts`).
- Move Seller-status logic to its own file (e.g. `sellerStatus.ts`).
- Move progress-count helpers to their own file (e.g. `progressCounts.ts`).
- Update every importer across `convex/` and `src/` to the new paths.

## Out of scope

- Any behavior change — pure move, like ticket 01.
- Merging or restructuring the Edition grant/access stack itself — edition-deepening already
  deepened that; this ticket only relocates the *other* concerns out of its file.
- `tenants.ts`'s equivalent split — note it, don't ticket it yet (see Why).

## Acceptance criteria

- [ ] `pnpm typecheck` clean.
- [ ] Full convex suite green, no new red beyond the known pre-existing `sales.test.ts` flake.
- [ ] `lib.ts` (or its renamed successor) contains only Edition-access code; a reader can delete
      the Seller-status or tenant-flag block from the repo without touching Edition-access code.

## Notes

Independent of ticket 01 (both are pure moves, no shared frontier, but 01 already landed so this
one starts from a clean `lib.ts` import surface).

## Comments
