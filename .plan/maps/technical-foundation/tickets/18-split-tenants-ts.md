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

## Answer

Done 2026-09-04. `convex/tenants.ts` holds the tenant row's own lifecycle and nothing else.

### True numbers

The Question's 738 lines was still exactly right (ticket 16 landed seven modules in `convex/`
the day before and touched this file's import line only). The counts it did not state were
taken before the first edit:

| | before (2026-09-04, pre-work) | after |
| --- | --- | --- |
| lines in `tenants.ts` | 738 | 149 |
| top-level `export`s | 22 (21 registered Convex functions + `TENANT_THEME_TOKENS`) | 5, all registered |
| `api.tenants.X` references repo-wide | 186, across 9 files | 89, across 4 files |

97 of those references were repointed at the module the function actually lives in now. No
re-export shim was left anywhere, so the remaining 89 are the five functions that really did
stay: `listTenants`, `createTenant`, `seedTenant`, `tenantReferenceCounts`, `removeTenant`.

### Modules created

Four new, one grown. Every registered function kept its name, its args, its guard and its
body verbatim; only its module path changed.

- `convex/tenantTheme.ts` (262 lines, 9 exports): the palette contract
  (`TENANT_THEME_TOKENS`, `DEFAULT_TENANT_THEME`, `assertThemeTokens`,
  `themeWithAssetsPreserved`) and the six functions that serve or write a tenant's skin:
  `getTheme`, `setTenantTheme`, `updateTenantTheme`, `updateTenantMotto`, `setTenantAsset`,
  `seedTenantAsset`.
- `convex/tenantAssignment.ts` (224, 7): `courseAssignment`, `assignCourse`,
  `unassignCourse`, `memberAssignment`, `assignMember`, `unassignMember`, `setTenantAdmin`,
  with the issue-22 banner comment that framed them.
- `convex/tenantDonations.ts` (74, 2): `donationPayeeEmail`, `setDonationPayee`. The only
  part of the file that read `sellers`.
- `convex/tenantFlags.ts` (32 to 98, 2 exports to 4): not new. `setTenantFlags` and
  `DEFAULT_TENANT_FLAGS` moved *into* the module that already held `assertTenantFlag`, so
  the gate and the switch that feeds it sit together.
- `convex/tenants.ts` (149, 5): `listTenants`, `createTenant`, `seedTenant`,
  `tenantReferences`, `tenantReferenceCounts`, `removeTenant`. What a tenant *is*, not what
  it looks like or what it holds.

All the import edges point one way: `tenants.ts` imports `DEFAULT_TENANT_THEME` and
`assertThemeTokens` from `tenantTheme.ts` and `DEFAULT_TENANT_FLAGS` from `tenantFlags.ts`,
and none of the four imports anything back from `tenants.ts`.

### The circular-import trap, and where it was

16's lesson applied here, in a different shape. The shared thing was not a constant but
`normaliseEmail`: `tenants.ts` carried its own private copy, and two of the concerns being
split apart (member allocation and the donation payee) each needed it, so the split would
have forced either a duplicate or a sideways import between two peer modules.

It did not need a new root module. `convex/shareGrants.ts` (from 16) already exports the
byte-identical function and eight convex modules already import it from there, so the fix
was to delete the third copy, not to move it. That went in first, alone, in commit `aab8fa8`,
before any move.

### The theming decision, and what ticket 23 needs to know

The whole theming concern went to `convex/tenantTheme.ts`, and **the mirrored 14-token
palette went with it**. Specifically, for
[23](23-tenant-token-mirror-has-no-test.md):

- the `ponytail:` marker is now `convex/tenantTheme.ts:20`, and `TENANT_THEME_TOKENS` is
  declared at `convex/tenantTheme.ts:23`. It was `convex/tenants.ts:16` when 23 was filed.
- `DEFAULT_TENANT_THEME`, the *other* hand-mirror in that file (the light `--color-*` values
  copied out of `src/styles/globals.css`), is in the same module, just below it.
- the Convex-side list is unchanged byte for byte. Nothing was de-duplicated and no
  comparison test was written: that is 23's job, not this ticket's.
- the assertion 23 names as the Convex-side guard is still in `convex/tenants.test.ts`,
  which now imports the list from `./tenantTheme` rather than `./tenants`.

`src/design/tokens.ts` was not touched beyond a comment repoint. Ticket 03 (the shadcn
foundation) was not pulled forward: nothing here changes what the tokens are or who owns
them, only which Convex file the mirror sits in.

### Deliberately left behind

- **`seeding` is not a module.** The Question listed it as a concern, but there is no
  seeding concern to extract: `seedTenant` and `seedTenantAsset` are PUBLISH_SECRET-guarded
  twins of `createTenant` and `setTenantAsset`, and they exist to be the *same write* under
  a different guard. Splitting a twin from its pair would put the two write paths that must
  never drift in different files, which is the failure the pair's own comments warn about.
  Each seed function moved with its twin instead.
- **`convex/tenants.test.ts` was not split.** It is 1009 lines and now exercises four
  modules. Only its `api.` paths and one import were rewritten. Splitting a test file is a
  different move with a different risk, and doing it in the same session would have made
  "the suite is unchanged" unverifiable.
- **`tenantReferences` / `tenantReferenceCounts` / `removeTenant`** stayed in `tenants.ts`
  even though their banner comment travelled to `tenantAssignment.ts`. Counting what still
  points at a tenant is the delete guard, which is the row's lifecycle, not allocation.

### Corrections made, each in its own commit

The split falsified eight comments across the tree that pointed into `convex/tenants.ts`
for code that had moved: five naming `assertThemeTokens` or `getTheme` (`convex/schema.ts`,
`src/design/tokens.ts`, `scripts/tenant-branding.ts`, `convex/shares.ts`, and the module
itself), two naming the ConvexError-in-production precedent set by `setTenantFlags`
(`convex/content/authoring.ts`, `convex/vouchers.ts`), and one naming `assignCourse`
(`convex/tenantBackfill.ts`). All repointed in `d51920e`, comments only.

`docs/ponytail-debt.md` was corrected in place in the same commit, twice: its hoist-target
advice for `convex/eft.ts:473` named `convex/tenants.ts` as a whole and now names the module
that matches the read, and its `TENANT_THEME_TOKENS` row was anchored on
`convex/tenants.ts:16`.

`convex/tenantFlags.ts` lost the parenthetical calling itself a plain module with no Convex
functions registered, which `setTenantFlags` arriving made false.

### Bug spotted, not fixed

None. Nothing was found that changes behaviour, and no commit here changes any. The one
non-move commit (`aab8fa8`) deletes a duplicate function whose body is character for
character the one it now imports.

### Evidence

`pnpm typecheck` clean and `pnpm vitest run` green after every one of the six commits:
**86 files, 1037 tests passed**, identical to the baseline taken before the first edit. This
ticket's Done when is entirely compile-and-test checkable, so the evidence is a green
typecheck and suite, **not a browser walk**. Nothing was clicked and nothing needed to be,
because no commit here changes behaviour. `convex/_generated/api.d.ts` was regenerated with
`convex codegen` and committed alongside each module that caused it to change.
