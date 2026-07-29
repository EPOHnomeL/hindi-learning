# Issue tracker: two homes, split by kind

There are deliberately **two** places a ticket can live, and which one it belongs
in is decided by *what kind of ticket it is* — not by convenience, and not by
which tool is closer to hand. This is a split, not drift: an earlier reading of
this file treated the local tickets as a backlog that "can't be read in one
place" and something to be migrated. It isn't. Leave it alone.

## Local — `.scratch/<feature-slug>/issues/` — **implementation work**

The default for anything an agent will build. Ephemeral by nature: it describes a
change to this codebase, it gets implemented, and then it is history the commits
already record.

- One Markdown file per unit of work, `NN-kebab-title.md`.
- Lives beside its PRD at `.scratch/<feature-slug>/PRD.md`.
- No triage labels — a local ticket is either open or done, tracked by the
  `**Status:**` line at the top.

## GitHub — `gh issue …` — **non-ephemeral, non-implementation**

Reserved for tickets that need to outlive the work, or that exist to be
*discussed* rather than built:

- Planning and scoping questions worked out collaboratively.
- Product decisions and open forks awaiting a human answer.
- Anything a collaborator needs to see, comment on, or be assigned.
- Long-lived concerns with no implementation attached yet.

If the answer to "who else needs to read this?" is "nobody, an agent just needs
to build it", it is a local ticket.

## Conventions (both homes)

- Title: `<feature-slug>/<NN>: <title>` where useful, or a plain descriptive
  title for standalone asks not tied to a feature/PRD.
- Body sections, in order, using only the ones that apply: `Why`, `Scope`,
  `Out of scope`, `Acceptance criteria`, `Tests`, `Notes`.
- Reference dependent/blocking work inline — `#N` for a GitHub issue, a relative
  path for a local one.
- See [issue-template.md](issue-template.md) for a fillable copy of this shape.

### GitHub only

- Apply a triage role label on creation (see [triage-labels.md](triage-labels.md)).
- Conversation/history goes as issue comments (`gh issue comment`), append-only.

## When a skill says "publish to the issue tracker"

Decide by kind, per the split above. Implementation work → a Markdown file under
`.scratch/<feature-slug>/issues/`. Non-ephemeral or discussion-shaped → `gh issue
create` with a triage label.

## When a skill says "fetch the relevant ticket"

The user will normally name the number, title, or feature. A `#N` means GitHub
(`gh issue view <n>`); a feature slug means look under
`.scratch/<feature-slug>/issues/`.

## History

Local → GitHub #12–#36 on 2026-07-10 → local again on 2026-07-15 → GitHub
reenabled 2026-07-24 → split by kind on 2026-07-29 (this file's current rule).
Note that issues filed before 2026-07-29 predate the split, so GitHub still
carries a large number of implementation tickets; they are grandfathered, not a
precedent. If the rule changes again, update this file and `CLAUDE.md` together.
