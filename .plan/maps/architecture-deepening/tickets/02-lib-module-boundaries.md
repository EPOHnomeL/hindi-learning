---
type: task
blocked_by: []
---

# Give lib.ts's sections real module boundaries

## Question

`convex/lib.ts` (732 lines) is turning into a kitchen-sink module. Every edition-deepening ticket
added another section to the same file instead of a module: content-blob URL building
(`lib.ts:83-116`), tenant flag gating (`124-149`), topic resolvers (`151-226`), the whole Edition
grant/access/paygate stack (`228-654` — `loadEdition`, `grantsFor`, `resolveEdition`,
`readLesson`/`readReference`, the genuinely deep part built across four edition-deepening
tickets), title translation (`656-673`), Seller status (`516-556`), and progress counts
(`714-732`). No sub-module boundary exists — just section-header comments.

Deletion test: deleting the Seller-status block or the tenant-flag block wouldn't touch the
Edition-access code at all — these are unrelated concerns cohabiting one file by convention, not
by design. (`convex/tenants.ts`, 607 lines, shows the same pattern — worth checking whether this
approach extends there, once proven on `lib.ts`.)

Scope: keep the Edition-access deep module (`loadEdition`, `grantsFor`, `resolveEdition`,
`readLesson`/`referenceToc`/etc.) in `lib.ts` — or rename to `edition.ts` if that reads better
against `CONTEXT.md`'s Edition vocabulary (grill the name before committing to it). Move
tenant-flag gating (`assertTenantFlag` and friends) to `tenantFlags.ts`, Seller-status logic to
`sellerStatus.ts`, progress-count helpers to `progressCounts.ts`, and update every importer across
`convex/` and `src/`. Pure move, no behavior change; do not restructure the Edition grant/access
stack itself; note `tenants.ts`'s equivalent split, don't ticket it yet.

## Done when

A reader can delete the Seller-status, tenant-flag or progress-count module from the repo without
touching Edition-access code (the deletion test this ticket was framed on), with `pnpm typecheck`
clean and the full convex suite green (no new red beyond the known `sales.test.ts` flake).

## Answer

**Landed** on `main` (`2adb6c2`). Tenant-flag gating, Seller readiness and progress counts were
split out of `convex/lib.ts` into `tenantFlags.ts` / `sellerStatus.ts` / `progressCounts.ts`;
`lib.test.ts` (all tenant-flag tests) moved to `tenantFlags.test.ts`. Pure move.

`lib.ts` keeps its name and its other residents, deliberately. The "`lib.ts` contains only
Edition-access code" criterion is only **partially met on purpose**: the three concerns Scope
named are out, but `lib.ts` still holds the topic resolvers, the content-blob helpers,
`assertAdmin`, and the small share/email/token/hash primitives, none of which Scope asked to move.
Emptying it fully would mean re-pointing ~25 more import sites in the same breath, so the
`lib.ts` → `edition.ts` rename was **declined** — while those residents remain, `edition.ts` would
misname the file. A follow-up ticket can finish the job and then earn the rename (see the map's
Follow-ups).
