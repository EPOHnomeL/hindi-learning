# Editing a shipped Edition: the local round-trip

**Added 2026-09-01.** The framework for changing the content of an Edition that is
already in the Hub: pull it to disk, edit it with whatever tool suits the job, push
the edits back. `scripts/edition.ts` (CLI) and `scripts/edition-workspace.ts` (the
pure layout/gate logic, tested in `scripts/edition-workspace.test.ts`).

An **Edition** is one (Topic x language) pair, held as `translations` rows. English is
the implicit source and has no rows, so it is **not** editable this way: change the
source with `scripts/publish.ts`. See [CONTEXT.md](../../CONTEXT.md).

## Why it exists

The same three steps had been hand-rolled twice as one-off scripts, and both times the
interesting part was the local transform while the download/upload scaffolding around
it got re-derived from scratch:

- **`scripts/st-za-rewrite.ts`** (2026-08-02), the `st` to `st-ZA` orthography rewrite.
- **The Devanagari conversion** (2026-08-04), `hi-Latn` to `hi` for prophetic-school,
  run out of a gitignored `topics/_devanagari/` from a temporary handoff doc. Its map,
  [.plan/maps/hindi-devanagari-edition/](../../.plan/maps/hindi-devanagari-edition/map.md),
  closed with "generalising is a fresh effort if the proof holds". This is it.

Both shipped rows past a guard that turned out to be dead code. The gates below are
that history, made mechanical.

## The shape

```
editions/<slug>/<lang>/pristine/     exactly what the Hub holds. Never edit.
editions/<slug>/<lang>/working/      the same bytes, for you to change.
editions/<slug>/<lang>/edition.json  the manifest: rows, owner, deployment, pull time.
```

`editions/` is **gitignored**. It is a local checkout of what the Hub already holds,
one pull away from being regenerated, and the Hub stays the source of truth (ADR 0009).

Both trees mirror the layout of `scripts/publish-translation.ts`, so `lessons/<key>.html`,
`references/<key>.html`, `title.txt`, `mission.txt`. A Lesson's stored title is re-derived
from the document's own `<title>` on push, so there is no second file to keep in sync.

```bash
pnpm edition:pull:prod --topic prophetic-school --lang st-ZA
git diff --no-index editions/prophetic-school/st-ZA/pristine editions/prophetic-school/st-ZA/working
pnpm edition:push:prod --topic prophetic-school --lang st-ZA            # dry run
pnpm edition:push:prod --topic prophetic-school --lang st-ZA --go       # writes
```

**The transform is deliberately not part of the framework.** A regex script, an agent
fan-out, or a human in an editor are all the same thing to it: something that changed
files in `working/`.

## What push will not do

Push is a **dry run unless you pass `--go`**, and it refuses the *whole run* if any
item trips a gate, rather than shipping the rest. Half a converted Edition reads as two
different courses and nothing on disk records where the seam is.

| gate | why |
| --- | --- |
| `quiz-drift` | The `data-correct` / `data-answer` / `data-k` counts moved. The server would return `skipped` and that Lesson would silently fall back to **English**. |
| `placeholder` | A `swapOutStatic` block marker survived, so `swapBackStatic` never ran. Publishing ships a Lesson with its `<style>`/`<script>` missing. |
| `empty` | A blanked `title.txt` / `mission.txt` **deletes** the row server-side. Real operation, never an accidental one. |
| `no-title` | `publishTranslation` is a `db.replace`, so a title left out is dropped, not kept. |
| `missing` | A deleted working file does not delete a row. Restore it or re-pull. |

## Two titles per Lesson, and they drift

A Lesson has a **stored row title** (`translations.title`, what lesson lists and cards
render) and the **document's own `<title>`** (the browser tab). They are set together on
publish and can then drift, because an Edition translated in more than one pass ends up
with rows whose stored title came from an older, rougher pass than the body did.

Measured on `prophetic-school`/`es` on 2026-09-01: **40 of 56 lessons** disagreed, with
the stored titles in mixed register (`Lleve`, `Practique`, `Adorad y sed llenos`) against
`tú` in the documents. One row, lesson 3, had **no stored title at all** and an entirely
English `<title>`, which is what a reviewer saw leaking into the Spanish lesson list.

So push derives the title from the document **only when the document's `<title>` was
actually edited**; otherwise the stored title round-trips untouched. Without that rule the
first push of any single unrelated row would have rewritten all 40. To change a stored
title, edit that document's `<title>` (keeping the `Lección N · ` prefix, which
`titleFrom` strips).

Use `--only <key>[,<key>]` to scope a push to named rows; a lesson-number prefix
(`--only 0003,0021`) is enough, and `title`/`mission` are named by kind. Worth reaching
for when applying a reviewer's list against a live Edition, so the blast radius is
exactly the rows on the list.

## Things that cost someone a round-trip already

- **Only what changed is sent**, plus every **blob-backed** row. A row whose body still
  lives in a `_storage` blob may be sharing that blob with the Edition it was cloned
  from; republishing writes the body inline and clears `htmlStorageId`, which is what
  makes the row this Edition's own. Skipping it is how an "edit" silently never lands.
  `--all` forces the unchanged ones too.
- **The owner email is the Topic's owner**, not whoever runs the script, and not
  necessarily `OWNER_EMAIL` from `.env.local` (that belongs to whichever Topic the
  Routine last claimed). `publishTranslation` resolves by `(owner, slug)` and throws on
  a mismatch, and **Convex redacts thrown messages in production**, so a wrong value
  surfaces only as an opaque `Server Error`. Pull resolves it once through
  `translate.topicOwnerEmail` and records it in the manifest. `--owner` overrides.
- **Push goes through `publishTranslationChecked`** (the action), never the bare
  `publishTranslation` mutation, whose quiz guard cannot read a blob-backed source and
  so is dead code for Lessons.
- **The manifest remembers its deployment.** Pushing a dev-pulled workspace at prod is
  refused.
- **Re-pulling over local edits is refused** without `--force`.
- After a successful push, `pristine/` is re-based on the pushed bodies, so the next
  round of edits is a clean diff instead of replaying the last one forever.

## Out of scope, on purpose

Creating an Edition (`scripts/clone-edition.ts`), reporting it ready
(`translate.reportTranslation`), pricing it, and listing it in the catalogue. The last
two are **owner-only** and happen in the Editions panel, not from a script. A clone is
never published, so a freshly cloned Edition is invisible to every learner until the
owner flips Publish, which is how `st-ZA` sat finished-and-unreachable on prod for two
days.

`question` rows (learner Q&A) are skipped by pull and refused by push: a different job
with a different trust boundary.
