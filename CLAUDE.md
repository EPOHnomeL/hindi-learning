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
- **Map/ticket commits use the `map` type:** any commit that touches `.plan/`
  (maps, tickets, specs) is `map(<effort>): …` — e.g.
  `map(ui-overhaul): chart the UI/UX overhaul map`,
  `map(marketplace): add donation-link ticket`. Not `feat(…)`/`docs(…)`; the
  scope is the effort directory name under `.plan/maps/`. Keep planning changes
  in their own commit, separate from code.
- **Never stop the dev server.** The user runs `pnpm dev` themselves, often while
  you work. To check a route, curl an already-listening port 3000; if nothing is
  listening, skip the check and say so. Do **not** start a server and then kill
  "whatever is on 3000" (and never `taskkill /IM node.exe`): that repeatedly
  killed the user's own server on 2026-08-23. `pnpm typecheck` is the cheap
  verification that needs no server at all.
- **`.env` is the user's** — never edit/`sed`/`cp` it; tell the user the exact
  line to change. Reading config at runtime is fine.
- **A HITL prototype (`type: prototype` and `/prototype` generally) is not decided
  until the human has actually seen it.** On 2026-08-27 a ticket 16 (ui-overhaul)
  session built real prototype code straight into `src/`, a real throwaway route
  included, then answered the ticket with a "winner" the operator had never opened,
  it only existed as the session's own written description of the code. Reacting to
  a description is not reacting to a prototype. Show the human something they can
  actually look at **before** writing any of it to disk: an Artifact for a UI
  question is usually enough, costs nothing to redo, and does not touch the working
  tree at all. Only write files under `assets/` (or wire the throwaway route the
  `/prototype` skill describes) once you have a real reaction to react to, and only
  resolve the ticket after that, never before it or in place of it.
- **Issues have one home: `.plan/maps/`, driven by chartr** (2026-07-30). Every
  ticket — planning *and* implementation — is a Markdown file under
  `.plan/maps/<effort>/tickets/NN-slug.md` beside its `map.md`, committed to git.
  **GitHub issues are retired**: do not open, read, or reference `gh issue` for
  work tracking. The two-homes split of 2026-07-29 lasted one day and is gone;
  the 48 open GitHub issues were migrated into maps and deleted, and the closed
  ones stay closed on GitHub as history only. `.scratch/` is retired too — maps
  are not ephemeral, they are the record. See `docs/agents/issue-tracker.md` for
  the file format, which is the contract.

## Verify the claim before you reason from it

Written context records what was true **when it was written**, and this repo moves
faster than its notes. That is not a failing of the notes — it is the normal state
— but reasoning from a stale claim burns a session building for a world that no
longer exists. It has cost real time twice: `project-context.md` told agents to
switch off a live revenue rail for three weeks after FICA cleared, and two tickets
were reasoned about at length that were already built and shipped.

**Before you act on a factual claim in a ticket, map, spec, `project-context.md` or
a code comment — verify it in the tree.** It is seconds of work:

- *"X doesn't exist yet"* → `grep` for it. *"X is built"* → open the file.
- *"the status is Y"* → `git log --format='%h %ad %s' --date=short -- <file>` on
  whatever asserts it. **A ticket can be older than its own scope**: tickets get
  transcribed from a spec days after it was written, so check the ticket's own
  commit date against the dates of the things it describes.
- A `#NN` GitHub reference anywhere in `.plan/` points at a **deleted** issue (see
  Issues have one home). Don't try to open it — `grep -rn "issue #NN" .plan/` finds
  the `<!-- Migrated … -->` footer on the ticket that inherited it.

**When you find a stale claim, fix it where it lives** — in the same session, in its
own commit — rather than routing around it. Leaving it costs the next session the
same hour it just cost you. Two constraints on that fix:

- **Give the correction an absolute date**, never "recently" or "now".
- **Never rewrite an ADR to correct it.** A stale ADR gets a *superseding* ADR;
  the original stands as the record of what was decided and when.

**Prefer evidence over inference when you resolve a ticket, and say which you had.**
"Verified by reading the code" and "walked in a browser" are different claims, and a
resolution that doesn't distinguish them is how a built-but-never-seen feature gets
recorded as done.

## Feature workflow

**`wayfinder` is the main way of working in this repo.** Repo skills live in
`.claude/skills/` (symlinks into `.agents/skills/`) — `wayfinder` is one of them;
it is `disable-model-invocation: true`, so the user invokes it with `/wayfinder`
and an agent never starts one unasked. When work is big enough or foggy enough
that the *route* isn't visible — more than one agent session, several open
decisions — that is a wayfinder effort: a map at `.plan/maps/<effort>/map.md`
with one child ticket per decision, resolved **one per session**, planning not
doing. Read `.agents/skills/wayfinder/SKILL.md` before touching a map, and
[docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) for how a map, its
tickets, claims and blocking are expressed here — that file is the chartr
adapter and **overrides** the generic `.scratch/` shape described in
`.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md`.

For a change that is **not** map-sized — the route is already clear, one session
does it — do **not** use plan mode. Follow this pipeline:

1. **Grill** — run the `grilling` skill to stress-test the idea and pin down requirements.
2. **Spec** — capture the agreed scope as `.plan/maps/<effort>/spec.md` (see Issue tracker).
3. **Tickets** — break the spec into tickets, one per unit of work, under
   `.plan/maps/<effort>/tickets/` (see Issue tracker above — there is one home).
4. **Implement** — build each ticket with the `tdd` skill (test-first) and the `ponytail` skill (laziest solution that works).

If you can't tell which it is, the wayfinder test decides: try to state the open
questions sharply. All sharp and few → pipeline. Fog you can name but can't yet
phrase as questions → map.

## Agent skills

### Issue tracker

One home: **chartr**, plain Markdown under `.plan/maps/`, committed to git. A map is
`.plan/maps/<effort>/map.md`; its tickets are `tickets/NN-slug.md` beside it; a spec is
`spec.md`. GitHub issues and `.scratch/` are both retired (2026-07-30). chartr also drives
the wayfinder visualisations — the frontier, blocking edges and progress are *derived* from
these files, never written into them. See `docs/agents/issue-tracker.md`.

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
