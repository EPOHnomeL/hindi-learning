# Handoff — Wayfinder ticket 06: PRD + implementation-issue breakdown (the convergence ticket)

## Your task this session

Resolve the **final** ticket on the course-publishing map:
`.scratch/course-publishing/06-prd-and-issue-breakdown.md`.

This is a **`task`, not a grilling ticket** — no HITL decision loop. You *assemble* the agreed model
into the handoff spec. All seven decision tickets (01–05, 07, 08) are **closed**; you are the
convergence step. Follow the repo's feature pipeline (`CLAUDE.md`: PRD → issues).

## Deliverables (from the ticket body — read it)

1. Write `.scratch/course-publishing/PRD.md` — the agreed scope + the schema/migration deltas each
   decision implies.
2. Break it into numbered local implementation issues (`.scratch/course-publishing/issues/NN-…` or
   continuing this dir's numbering — check what the whitelabel map did, mirror it), in **dependency
   order**, sized for a `/tdd` + `/ponytail` build.
3. Flip the map's Status to **destination reached** and record the PRD link.

## Source of truth — read every decision ticket, do NOT work from memory

The map's **Decisions so far** section gists each; the ticket files hold the detail. Read all of:

- `00-course-publishing-map.md` — the index + pinned codebase facts + Out-of-scope list.
- `01-model-self-enroll-grant.md` + `adr-0023-draft-self-enroll-access-primitive.md` — the
  `enrollments` grant.
- `02-per-tenant-selling-flag.md` — the `tenants.flags.selling` boolean.
- `03-define-publish-action.md` — the `status` lifecycle.
- `04-default-site-vs-tenant-scope.md` — symmetric catalogue scoping + default-site selling rule.
- `05-tenant-catalogue-surface.md` — the "Browse courses" surface (**read the Resolution — the
  prototype code was deleted; the spec lives in words here**).
- `07-language-scoped-access.md` — **RESCOPED, read carefully** (see the trap below).
- `08-tenant-domain-links.md` — convention-based tenant origin for server-built links.

## Traps — late rescopes that must NOT leak into the PRD

The last two sessions changed shape. Working from the *original* ticket premises would produce a wrong
PRD. Specifically:

- **Ticket 07 collapsed.** There is **NO** `users.contentLang` field, **NO** access-rule scoping,
  **NO** disabled/greyed cross-language cards, **NO** switching/grandfather logic in the PRD. What
  survived is only: a **per-card language pick (default English)** on the catalogue; **Join** enrolls
  the selected Edition → one `enrollments` row; **Re-Join** for another language (idempotent,
  per-Edition, grandfathered — *ticket 01 unchanged, no new data model*); **every published course is
  joinable in ≥ English (no locked cards)**; the language control is **gated by the tenant
  `translations` flag** (off ⟹ English-only Join). Content translation itself already ships
  (`translations` table, `convex/translate.ts`, the reader's per-Edition switcher).
- **Ticket 05's disabled cards were deleted**, pending the now-collapsed 07. No locked/greyed cards.
- **Ticket 05 parked a follow-up:** selecting a language should also localize the card's **title +
  mission** (not just which Edition Join/Buy targets) — **explicitly NOT this build** (the catalogue
  query returns only source-language title/mission today). Record it as a deferred follow-up in the
  PRD, don't spec it. It's flagged for the chrome-i18n effort.
- **Ticket 08:** origin is derived by **convention** `<slug>.<base>` (base = `SITE_URL` host minus a
  leading `www`) — **no new env, no `tenants` host column**; custom domains stay ADR-0022 fog
  (out of scope). `appUrl` gains an optional `tenantSlug`; the open-redirect guard validates against
  the resolved origin.

## Schema / migration deltas the PRD must enumerate (verify against the tickets)

- **New `enrollments` table** `{ userId, topicId, lang }` (ticket 01) + resolver branch → `enrolled`.
- **`tenants.flags.selling`** new required boolean, default `false`, backfill migration for the four
  existing rows + seed path (ticket 02). `assertTenantFlag(…, "selling")` treats `tenantSlug == null`
  as **pass** (ticket 04).
- **`topics.status`** enum extended to `seeded | active | completed | published` + migration for
  existing rows (ticket 03).
- **`appUrl` gains optional `tenantSlug`** (ticket 08). No schema change for it.
- **No `users` change** — the content-language field died with 07.

## Out of scope (carry into the PRD's non-goals, from the map)

Member-initiated un-enroll; per-tenant merchant rails; replacing/removing the anonymous public link;
learner-progress % & lesson-estimate accuracy; card title/mission localization (deferred, above);
custom domains (ADR-0022).

## Concurrent-session hygiene

Other sessions are actively committing to `main` (reader/resource-links, teach-skill guidance, and
possibly the chrome-i18n effort). **Stage only your own files by path**; never `git add -A`. Re-check
`git diff --cached --stat` before committing; never `--amend`.

## Suggested skills

- `/ponytail` posture — four known tenants; keep implementation issues minimal, no speculative platform.
- `convex:convex-expert` — sanity-check the `enrollments` table, the `topics.status` migration, and
  the `tenants.flags.selling` backfill before writing them into issues.
- Mirror the **whitelabel map's** conclusion format (`.scratch/whitelabel/PRD.md` + numbered issues)
  for consistency — read it as the template.
- `/tdd` is for the *build*, not this ticket — but reference it in each issue as the intended loop.

## Commit convention

`docs(course-publishing): resolve ticket 06 — PRD + implementation issues`, staged by path, ending:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Prior pattern: commit
`29e08d8` (ticket 04). Push only if asked.

## When done

This is the map's **destination**. After ticket 06 closes, the planning map is complete — the next
step is a `/tdd` build effort against the PRD, a separate undertaking.
