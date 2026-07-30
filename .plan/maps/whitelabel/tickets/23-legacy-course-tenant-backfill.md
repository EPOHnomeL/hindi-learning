---
type: task
blocked_by: [07, 11, 13]
---
# Legacy course tenant backfill

## Question

Both 01 and 03 explicitly called this out as a **downstream issue, not a v1 mechanism** — new
courses generated in a tenant's style get full palette fidelity baked in at publish; existing
pre-whitelabel courses only get the partial-fidelity 14-var override from 13 until migrated. Not
required for v1 correctness, but needed before an existing course looks fully native. Ground truth:
01 decision 1; 03 implementation issue 9. Scope:

- A migration script (`scripts/*.ts` pattern, plain + `:prod`) that: assigns a `tenantSlug` to a
  chosen set of existing courses (operator-driven — which courses move to which tenant is a content
  decision); re-bakes each course's stored HTML blob with that tenant's full palette (beyond the 14
  override vars 13 injects at render), so legacy content reaches tenant-generated fidelity.
- Pairs with (but does not require building) a "generate new courses in-style" authoring path.

## Done when

Running the script against a chosen course + tenant slug sets `tenantSlug` and produces a re-baked
blob visually matching the tenant's full palette (not just the 14-var override); courses not
selected are untouched; idempotent (running twice doesn't double-migrate or corrupt the blob).

## Answer

Built test-first 2026-07-18 (opus, `/tdd` + `/ponytail`) — an operator migration script, not a
runtime mechanism; same shape as `seed-tenants`/`backfill-html-blobs` (plain + `:prod`,
PUBLISH_SECRET-guarded).

**How the re-bake works:** full fidelity beyond 13's render-time 14-var override comes from a
**value substitution** — every occurrence of a **default palette hex** (the design system's
`:root{}`/`:root[data-theme="dark"]{}` values in `lessons/_partials/head.html`) is swapped for the
tenant's corresponding hex across the whole stored blob. That repaints both the `:root{}` var
declarations **and** the hardcoded literals that reused those same values (e.g. `border-bottom:1px
solid #e7ddd4`) — the ones the render-time override can't reach. Literals that aren't a default token
value stay as authored: strictly more fidelity than 13, not pixel-perfect (the accepted bar). The
default palette is read **live** from head.html so the bake never drifts from what publish.ts inlines.
8-digit alpha hexes keep their alpha.

**What shipped:**
- **`scripts/tenant-course-backfill.ts`** — the driver + the pure, unit-tested core
  (`extractRootPalette`, `buildSubstitutions`, `bakeTenantPalette`), following the
  `tenant-branding.ts`/`.test.ts` pattern. Assigns `topics.tenantSlug`, then re-bakes every Lesson,
  Reference, and translated lesson/reference Edition of the course.
- **`convex/tenantBackfill.ts`** — thin, secret-guarded I/O only: `setCourseTenant` (operator twin of
  `tenants.assignCourse`, refuses to steal another tenant's course), `courseArtifacts` (lists the
  course's re-bakeable refs via `topicId`-prefixed indexed reads), and `readArtifactHtml`/
  `writeArtifactHtml` (blob get/store, action-only, with inline-html fallback for translations).
  Blobs are minted new & repointed (immutable, ADR 0003).
- **`package.json`** — `tenant-course-backfill` + `tenant-course-backfill:prod`.

**Acceptance:** sets `tenantSlug` + full-palette re-bake ✓ (covers hardcoded literals, not just the
14 vars); unselected courses untouched ✓; idempotent ✓ — a re-baked blob carries a
`<!--tenant-palette-baked-->` sentinel; a second run skips any stamped blob (the swap is a single
left-to-right pass, sentinel is the hard gate). Assign-before-bake means an interrupted run resumes cleanly.

**Verification:** `scripts/tenant-course-backfill.test.ts` (10 cases: palette extraction,
substitution, repaint of var decls + literals, alpha preservation, idempotency, no-swap stamping,
collision safety) green; typecheck + `pnpm build` clean. (One unrelated failing test —
`convex/invite-emails.test.ts` — is another session's WIP, not from this work.)

**⚠ Real re-bake is the operator's call** — dev has no published course under a tenant to eyeball;
pairs with 11/13's pending visual check. Run: `pnpm tenant-course-backfill <course-slug>
<tenant-slug>` (dev) / `--prod` (live, snapshot first). Needs `PUBLISH_SECRET` (and `CONVEX_PROD_URL`
for `:prod`) in `.env.local`, same as the other operator scripts.
