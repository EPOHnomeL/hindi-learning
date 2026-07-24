# Issue tracker: local markdown under `.scratch/`

Issues live as local markdown files: `.scratch/<feature-slug>/issues/<NN>-<dash-case-title>.md`.
PRDs live alongside them as `.scratch/<feature-slug>/PRD.md`.

GitHub Issues are **retired** (2026-07-15): every issue was imported into `.scratch/` (bodies,
labels, comments preserved, marked `**Imported:** from GitHub #N`) and then deleted on GitHub.
How work gets shared with other people is being rethought — until that lands, local files are
the only tracker. (History: local → GitHub #12–#36 on 2026-07-10 → local again on 2026-07-15.)

## Conventions

- The file's H1 is `<feature-slug>/<NN>: <title>`, numbered from `01` within a feature
- Front lines: `**Status:** open | done` (plus optional `**Depends on:**`, `**Labels:**`)
- Triage roles (see `triage-labels.md`) go on the `**Labels:**` line
- Body sections, in order, using only the ones that apply: `Why`, `Scope`, `Out of scope`,
  `Acceptance criteria`, `Tests`, `Notes`, `Comments`
- Conversation/history goes in the `Comments` section (append-only — never edit or delete a
  prior entry), or git history
- See [issue-template.md](issue-template.md) for a fillable copy of this shape

## When a skill says "publish to the issue tracker"

Create a local file at `.scratch/<feature-slug>/issues/<NN>-<title>.md` following
[issue-template.md](issue-template.md).

## When a skill says "fetch the relevant ticket"

Read the local file (the user will normally name the feature/ticket or path).
