# Issue tracker: GitHub Issues

Issues for this repo live on GitHub: <https://github.com/EPOHnomeL/hindi-learning/issues>.
Use the `gh` CLI. PRDs still live locally as `.scratch/<feature-slug>/PRD.md`.

## Conventions

- Issue titles are `<feature-slug>/<NN>: <title>` (e.g. `topic-sharing/06: Share management`), numbered from `01` within a feature
- Triage state is a GitHub label (see `triage-labels.md` for the role strings)
- Comments and conversation history go in GitHub issue comments

History: until 2026-07-10 issues were local markdown under `.scratch/<feature>/issues/`;
the outstanding ones were migrated to GitHub issues #12–#36 and the local files deleted
(still readable in git history before commit dd70b93).

## When a skill says "publish to the issue tracker"

Create a GitHub issue: `gh issue create --title "<feature-slug>/<NN>: <title>" --body-file <file> [--label <role>]`.

## When a skill says "fetch the relevant ticket"

`gh issue view <number>` (the user will normally pass the issue number or URL directly).
