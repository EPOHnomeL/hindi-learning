# course-publishing/06: PRD + implementation-issue breakdown

**Status:** done (2026-07-19) — the map's destination.
**Depends on:** 01, 02, 03, 04, 05, 07, 08
**Labels:** wayfinder:task

Child of [Course publishing map](00-course-publishing-map.md).

## Question

The convergence ticket — the map's **destination**. Once every decision ticket (01–05) is closed,
capture the agreed model as the handoff spec, following the repo's feature pipeline
(`CLAUDE.md`: PRD → issues):

1. Write **`.scratch/course-publishing/PRD.md`** — the agreed scope: the enroll grant primitive &
   granularity (01), the `selling` flag (02), the publish action & states (03), default-site scope
   (04), the catalogue surface (05), and language-scoped access (07), plus the schema/migration
   deltas each implies.
2. Break the PRD into local **implementation issues** (`07-…` onward in this directory), in
   dependency order, sized for a `/tdd` + `/ponytail` build — mirroring how the whitelabel map
   concluded (PRD + numbered implementation issues).
3. Flip the map's Status to **destination reached** and record the PRD link.

Not a decision or an investigation — a writing/organising task once 01–05 have supplied the content.
It **does** rather than decides, and earns its place as the artifact the whole map exists to produce.
This is where the planning map ends and a build effort would begin. Resolve, comment, close.

## Resolution (2026-07-19)

Assembled the eight closed decisions (01–05, 07, 08) into **[PRD.md](PRD.md)** and eight
dependency-ordered implementation issues (`09`–`16` in this directory), each sized for a `/tdd` +
`/ponytail` build. No decisions were re-litigated. The late rescopes were held out of the spec: the
collapsed ticket-07 content-language *access* layer (no `users.contentLang`, no disabled cards) is
absent; only the thin per-card language pick survives. Two implementation calls the tickets left
implicit are flagged in the PRD/issues rather than silently decided — extending `setEditionPrice`'s
`completed`-only gate to also accept `published` (issue 10), and the `SITE_URL`-now-required
consequence of retiring `APP_BASE_URL` (issue 12). Map Status flipped to **destination reached**; the
next step is a separate `/tdd` build effort against the PRD.

