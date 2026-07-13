# PRD: Edit an Edition's title & mission

Status: ready — grilled and agreed (2026-07-13).

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Edition**,
> **Editor** (ADR 0020), **owner**. Builds on the per-item translation rows
> (`translations`, `kind: "title" | "mission"`, `key: ""`) and the
> owner-or-Editor edit gate `getEditableTopic`
> ([edition-editor-rights](../edition-editor-rights/PRD.md)).

## Problem Statement

Gemini's machine translation of a course's **title** and **mission** can be
awkward — and today there is no way to fix them. `renameTopic` / `editMission`
edit only the English source; a translated Edition's title/mission are
whatever the run produced. (Concrete case: the Afrikaans edition of "Growing
your relationship with the Holy Spirit".) Lessons already have in-place
edition edits; the topic-level texts are the gap.

## Solution

A single mutation upserts the translated title or mission of one Edition,
gated **owner or that Edition's Editor** — the same trust boundary as
translated-Lesson edits. The UI is a pencil on the course title in the course
header that opens one small **"Edit title & mission"** dialog for the Edition
being viewed. Manual edits stamp `sourceHash`, so a later re-translate
**keeps** them (identical to Lesson-edit semantics); they go stale only if
the English source text itself changes afterwards.

## User Stories

1. As an owner viewing the Afrikaans edition, I want to fix its translated
   title in place, so the tab and header read naturally.
2. As an Editor of one Edition, I want to fix that Edition's title and
   mission — and no other Edition's — so my rights match my lesson rights.
3. As an owner, I want a hand-fixed title to survive a re-translate, so a
   retry never clobbers curation.
4. As a viewer/Guest, I want no edit affordance and a rejected mutation.
5. As an editor, I want clearing a field to revert that text to the
   auto-translation fallback (the English source until re-translated), so a
   bad edit is recoverable.

## Implementation Decisions

- **One mutation `editEditionText({ topicSlug, lang, kind: "title" | "mission",
  text })`** in `translate.ts` (it owns the `translations` table semantics):
  - Rejects `lang === SOURCE_LANG` — the source keeps its existing owner-only
    paths (`renameTopic`, `editMission`).
  - Gate: `getEditableTopic(ctx, userId, topicSlug, lang)`.
  - `kind: "mission"` requires the Topic to *have* a mission (mirrors the
    translate run's `collectItems`).
  - Non-blank `text` → upsert the `(topicId, lang, kind, key: "")` row with
    `text` and `sourceHash = itemHash(kind, { text: <current source text> })`
    — the stamp that makes `isFresh` skip it on re-translate.
  - **Blank `text` → delete the row** — "revert to auto": the reader falls
    back to the English source, and the next re-translate regenerates it.
- **UI: pencil on the title in the course header** (`CourseShell`), shown only
  on a **translated** edition when the caller may edit it (`lang !== "en" &&
  canEdit`). It opens one dialog with a title input and a mission textarea,
  pre-filled with the currently-served texts (`courseHeader` now also carries
  the served `mission`); save calls `editEditionText` per changed field.
  The **English** edition keeps its existing owner-only surface (Course
  settings → Details) rather than growing a duplicate pencil — en-Editors have
  no title/mission rights anyway (ADR 0020). Reuses the shared Dialog
  primitive.
- **Readers unchanged** — `courseHeader`, dashboard, and certificate paths
  already resolve title/mission through `translations`; writing the same rows
  is enough. Reactivity propagates the fix.

## Testing Decisions

- **convex-test at the `editEditionText` seam** (extend the translate tests):
  - owner and Editor-of-that-lang succeed (insert and update paths); Viewer,
    Editor-of-another-lang, Guest, and `lang: "en"` are rejected;
  - the row carries the correct `sourceHash`: a subsequent re-translate run
    (fetch stub) skips the edited item (`isFresh` — no Gemini call, edit
    survives);
  - blank text deletes the row; reader query then serves the English fallback;
  - mission edit on a mission-less Topic is rejected.
- **No automated frontend test** — dialog verified by eye, consistent with
  prior reader-UI features.

## Out of Scope

- Editing the English source title/mission from the dialog for **Editors**
  (owner-only stays owner-only, ADR 0020).
- Translated **Reference titles** or any other per-item text — Lessons cover
  bodies already; this feature is topic-level texts only.
- Edit history/attribution; concurrent-edit handling (last write wins).

## Suggested Issue Breakdown

1. **Backend: `editEditionText`** — mutation + gate + sourceHash stamping +
   blank-deletes semantics, with the seam tests.
2. **UI: header pencil + dialog** — edition-aware title/mission dialog in
   `CourseShell`, wired to the right mutation per edition.
