## Context lives in the repo

All durable project context and agent guidance lives **in this repository** —
never in a machine-specific store (e.g. the `~/.claude` memory). Do not rely on
or write to per-machine memory; when you learn something durable, record it here:

- **How to work in this repo** → this file (CLAUDE.md).
- **Project facts** (environments, deploy, payments, whitelabel, gotchas) →
  [docs/agents/project-context.md](docs/agents/project-context.md).
- **Domain vocabulary** → [CONTEXT.md](CONTEXT.md); **decisions** → `docs/adr/`.

If the harness prompts you to save a memory, write it to the appropriate repo
file above instead. Context must travel with the repo, not the computer.

## Working conventions

- **Package manager: pnpm** (not npm) for installs, scripts, and adding packages.
  `pnpm-lock.yaml` is the lockfile of record. Prefer `pnpm dlx` over `npx`.
- **Commits:** commit straight to `main` (no feature branch). Split work into
  separate logical, conventional-commit (`feat(scope): …`) commits; end messages
  with the `Co-Authored-By` trailer. **Commit with `git commit --only <paths>`**
  (add an untracked file with `git add -N` first) — the user runs concurrent
  sessions on `main` and the index is shared, so a plain `git add` + `git commit`
  will happily swallow whatever another session staged in between. Never
  `git add -A`/`.`, never `git commit --amend` (amend swallows another session's
  staged files). `--only` still commits the *whole current content* of the paths
  you name, so `git diff <paths>` first and don't name a file another session is
  mid-edit in. Push only when asked.
- **`.env` is the user's** — never edit/`sed`/`cp` it; tell the user the exact
  line to change. Reading config at runtime is fine.
- **Issues have two homes, split by kind** (2026-07-29). **Implementation work →
  local Markdown** under `.scratch/<feature>/issues/`, beside its PRD — it gets
  built and then the commits are the record. **GitHub (`gh issue`) is reserved
  for non-ephemeral, non-implementation tickets**: planning, scoping, product
  decisions, open forks, anything a collaborator reads or comments on. Test:
  if nobody but the implementing agent needs to read it, it is local. Issues
  filed before 2026-07-29 predate the split — GitHub still holds many
  implementation tickets, grandfathered, not a precedent. See
  `docs/agents/issue-tracker.md`.

## Feature workflow

**`wayfinder` is the main way of working in this repo.** Repo skills live in
`.claude/skills/` (symlinks into `.agents/skills/`) — `wayfinder` is one of them;
it is `disable-model-invocation: true`, so the user invokes it with `/wayfinder`
and an agent never starts one unasked. When work is big enough or foggy enough
that the *route* isn't visible — more than one agent session, several open
decisions — that is a wayfinder effort: a `wayfinder:map` at
`.scratch/<effort>/map.md` (or `issues/00-…-map.md`, as `ywampotch-launch` has
it) with one child ticket per decision, resolved **one per session**, planning
not doing. Read `.agents/skills/wayfinder/SKILL.md` before touching a map, and
`.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md` §"Wayfinding
operations" for how a map, its tickets, claims and blocking are expressed here.

For a change that is **not** map-sized — the route is already clear, one session
does it — do **not** use plan mode. Follow this pipeline:

1. **Grill** — run the `grilling` skill to stress-test the idea and pin down requirements.
2. **PRD** — capture the agreed scope as a PRD under `.scratch/<feature>/` (see Issue tracker).
3. **Issues** — break the PRD into tickets, one per unit of work, in the home its
   kind calls for (see Issue tracker above — implementation work is local).
4. **Implement** — build each issue with the `tdd` skill (test-first) and the `ponytail` skill (laziest solution that works).

If you can't tell which it is, the wayfinder test decides: try to state the open
questions sharply. All sharp and few → pipeline. Fog you can name but can't yet
phrase as questions → map.

## Agent skills

### Issue tracker

Two homes, split by kind: implementation tickets are local Markdown under `.scratch/<feature>/issues/`;
GitHub is for non-ephemeral, non-implementation tickets (planning, decisions, collaboration). PRDs live
locally as `.scratch/<feature>/PRD.md`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using the default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Interactive knowledge bank (glossary, ADRs, system map, code drawer): run `pnpm documentation` and
open <http://localhost:3000/> (the root redirects to the bank via `serve.json`). Sources live under
`docs/architecture/` (registries in `index.html`, meta generator in `tooling/docs-meta.mjs`);
authoring contract in `docs/architecture/README.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
