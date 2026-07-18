# whitelabel/23: Legacy course tenant backfill

**Status:** implemented (2026-07-18) — a real prod re-bake is the operator's call (see Running it)
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

---

## Resolution (2026-07-18, opus — `/tdd` + `/ponytail`)

An operator migration script, not a runtime mechanism — same shape as
`seed-tenants` / `backfill-html-blobs` (plain + `:prod`, PUBLISH_SECRET-guarded).

### How the re-bake works

Full fidelity beyond issue 13's render-time 14-var override comes from a **value
substitution**: every occurrence of a **default palette hex** — the design
system's `:root{}` / `:root[data-theme="dark"]{}` values in
[`lessons/_partials/head.html`](../../../lessons/_partials/head.html) — is swapped
for the tenant's corresponding hex, across the whole stored blob. That repaints
**both** the `:root{}` var declarations **and** the hardcoded literals that reused
those same values (e.g. `border-bottom:1px solid #e7ddd4`, the default `--line`) —
the ones the render-time override can't reach. Literals that aren't a default token
value (the bespoke `#ece2d6` verse border, `#1f1b18` near-black, etc.) stay as
authored: strictly more fidelity than issue 13, not pixel-perfect, which is the
accepted bar (01 decision 1 / 03 called this a downstream polish, not v1). The
default palette is read **live** from head.html, so the bake never drifts from what
publish.ts actually inlines. 8-digit alpha hexes keep their alpha (`#b88a2e10`, a
shadow tint, → `#<tenant-gold>10`).

### What shipped

- **[`scripts/tenant-course-backfill.ts`](../../../scripts/tenant-course-backfill.ts)**
  — the driver + the pure, unit-tested core (`extractRootPalette`,
  `buildSubstitutions`, `bakeTenantPalette`), following the
  `tenant-branding.ts`/`.test.ts` testable-script pattern. Assigns
  `topics.tenantSlug`, then re-bakes every Lesson, Reference, and translated
  lesson/reference Edition of the course.
- **[`convex/tenantBackfill.ts`](../../../convex/tenantBackfill.ts)** — thin,
  secret-guarded I/O only (the palette logic lives in the script): `setCourseTenant`
  (operator twin of `tenants.assignCourse`, refuses to steal another tenant's
  course), `courseArtifacts` (lists the course's re-bakeable refs via `topicId`-
  prefixed indexed reads), and `readArtifactHtml` / `writeArtifactHtml` (blob
  get/store — action-only — with inline-html fallback for translations still stored
  inline). Blobs are minted new & repointed (immutable, ADR 0003).
- **`package.json`** — `tenant-course-backfill` + `tenant-course-backfill:prod`.

### Acceptance criteria

- **Sets `tenantSlug` + full-palette re-bake** ✓ — the swap covers the hardcoded
  literals, not just the 14 override vars.
- **Unselected courses untouched** ✓ — the script only ever reads/writes the one
  named course's artifacts.
- **Idempotent** ✓ — a re-baked blob carries a `<!--tenant-palette-baked-->`
  sentinel; a second run skips any stamped blob, so it never double-migrates or
  corrupts — even if a tenant hex collides with a default one (the swap is a single
  left-to-right pass, and the sentinel is the hard gate). Assign-before-bake means
  an interrupted run resumes cleanly.

### Verification

- **Unit:** `scripts/tenant-course-backfill.test.ts` (10 cases: palette extraction,
  substitution building, repaint of both var decls + literals, alpha preservation,
  idempotency, no-swap stamping, collision safety) green. `pnpm typecheck` clean;
  `pnpm build` clean. (One unrelated failing test — `convex/invite-emails.test.ts`,
  another session's uncommitted invite-email-branding WIP — is not from this work.)
- **⚠ Real re-bake is the operator's call** (see below) — dev has no published
  course under a tenant to eyeball; pairs with issue 11/13's pending visual check.

### Running it

```
pnpm tenant-course-backfill <course-slug> <tenant-slug>          # dev
pnpm tenant-course-backfill <course-slug> <tenant-slug> --prod   # live (snapshot first!)
```

Needs `PUBLISH_SECRET` (and `CONVEX_PROD_URL` for `:prod`) already in `.env.local`,
same as the other operator scripts — no new env var.
