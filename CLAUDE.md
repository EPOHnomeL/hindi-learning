## Feature workflow

For any non-trivial feature or change, do **not** use plan mode. Follow this pipeline:

1. **Grill** — run the `grilling` skill to stress-test the idea and pin down requirements.
2. **PRD** — capture the agreed scope as a PRD under `.scratch/<feature>/` (see Issue tracker).
3. **Issues** — break the PRD into issues under the same `.scratch/<feature>/` folder.
4. **Implement** — build each issue with the `tdd` skill (test-first) and the `ponytail` skill (laziest solution that works).

## Agent skills

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using the default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Interactive knowledge bank (glossary, ADRs, system map, code drawer): run `pnpm documentation` and
open <http://localhost:3000/docs/architecture/>. Sources live under `docs/architecture/` (registries
in `index.html`, meta generator in `tooling/docs-meta.mjs`); authoring contract in
`docs/architecture/README.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
