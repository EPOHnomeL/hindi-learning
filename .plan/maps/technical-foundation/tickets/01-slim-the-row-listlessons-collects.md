---
type: task
blocked_by: []
---

# Slim the translation row `listLessons` collects

## Question

`content/reader.listLessons` was 1.16 GB of Database I/O in Jul 8 – Aug 7 2026, the
single largest line on the bill. `784eb70` narrowed it to `kind: "lesson"` rows only,
which removed the references, questions and title rows it never read — but the lesson
rows *are* the bulk, and they are the fat ones.

To render a table of contents, `listLessons` needs one string per lesson: the
translated title. To get 132 titles it reads 132 rows, **each carrying a whole inline
translated HTML body** in `translations.html`. Convex has no column projection, so the
only way to stop reading the body is for the body not to be in that row.

**How do we make the row a title query reads slim, without reversing the 2026-08-04
decision that `translations.html` stays inline?**

The shape that appears to satisfy both: keep `translations` as the slim row
(`title` / `text` / `reply` / `sourceHash`) and move `html` + `htmlStorageId` into a
sibling table keyed by the same `(topicId, lang, kind, key)` tuple. The body stays
inline in a document — just not in the document the reader collects. Blob storage is
explicitly **not** the answer here; see the map's Notes.

Open sub-questions the resolving session must actually answer, not assume:

- **Is this worth doing at all?** It is worth ~$0.60/month at current traffic. The
  honest options include *close this out of scope*. Read the current bill first.
  Weigh it against the fact that the cost multiplies per Edition, and three mapped
  efforts add Editions.
- **Does the single-item read path get worse?** `lesson()` / `reference()` in
  `loadEdition` point-read one row and need the body. After a split that becomes two
  point reads. `getLesson` was 29.62 MB/month, so the headroom is large, but confirm
  rather than assume.
- **What writes both rows?** `publishTranslation` (and
  `publishTranslationChecked`), `content/authoring.applyTranslatedLessonEdit`,
  `scripts/st-za-rewrite.ts`, `cloneEdition`. Two rows where there was one means a
  torn-write question: a body with no slim row, or the reverse.
- **Widen → migrate → narrow, on live prod data.** The reads only get cheap at the
  *narrow* step, when `html` actually leaves the row — widen and migrate alone save
  nothing. The narrow step is therefore not optional, and it is the risky one.

## Done when

- A title-only query (`listLessons`, `listReferences`) reads rows that do **not**
  contain a translated body, verified by reading the code path — no fat field on the
  table it collects.
- Every write path lands both rows, or neither. Named above; none missed.
- Existing prod rows are migrated, and the narrow step has removed the fat field from
  the collected table.
- `translations.html` has NOT moved to blob storage — the 2026-08-04 decision still
  stands (a superseding ADR is required to change that, not this ticket).
- The reader is opened in a browser on a **non-English** Edition and lesson titles,
  reference titles and bodies all still render. Verified by walking it, not by tests
  alone — the whole cost is on the non-English path, and it is the path least covered.
- Full suite green (`pnpm vitest run`, 835 tests as of 2026-08-11) and `pnpm typecheck`
  clean.
- The next monthly bill's `listLessons` line is recorded in the `## Answer`, against
  the 1.16 GB baseline. A resolution without a measured number is not a resolution
  here — the map's destination is a measurement.

<!-- Filed 2026-08-11, from the audit that produced 784eb70. Numbers throughout are
     from invoice RJDCQK-00001 and the dashboard's by-function Database I/O view;
     the full baseline table lives in ../assets/convex-cost-baseline.md so it is not duplicated here. -->

<!-- Moved 2026-09-01 from `convex-cost/01` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 01 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
