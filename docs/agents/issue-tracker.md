# Issue tracker: GitHub Issues

Issues live on GitHub — use `gh issue create` / `gh issue list` / `gh issue view`. PRDs stay local
at `.scratch/<feature-slug>/PRD.md`; scoping notes that aren't ready to be a filed issue can also
live under `.scratch/<feature-slug>/issues/` as drafts before filing.

(History: local → GitHub #12–#36 on 2026-07-10 → local again on 2026-07-15 → GitHub reenabled
2026-07-24. If issues ever move again, update this file and `CLAUDE.md` together.)

## Conventions

- Title: `<feature-slug>/<NN>: <title>` where useful, or a plain descriptive title for
  standalone asks not tied to a feature/PRD.
- Apply a triage role label (see `triage-labels.md`) on creation.
- Reference dependent/blocking issues by `#N` in the body.
- Body sections, in order, using only the ones that apply: `Why`, `Scope`, `Out of scope`,
  `Acceptance criteria`, `Tests`, `Notes`.
- Conversation/history goes as issue comments (`gh issue comment`), append-only.
- See [issue-template.md](issue-template.md) for a fillable copy of this shape (adapt to
  `gh issue create --body-file`).

## When a skill says "publish to the issue tracker"

Create the issue with `gh issue create`, following [issue-template.md](issue-template.md) for
body structure, with a triage label from `triage-labels.md`.

## When a skill says "fetch the relevant ticket"

Look it up with `gh issue view <n>` (the user will normally name the number, title, or feature).
