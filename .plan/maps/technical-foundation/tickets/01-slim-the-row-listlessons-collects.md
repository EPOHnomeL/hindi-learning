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

## The 2026-09-09 measurement, and the one thing it adds to this ticket

The operator supplied the by-function dashboard read this ticket asked for ("read the
current bill first"). Full table and derivation in
[the baseline](../assets/convex-cost-baseline.md); the window is about one and a half
days, so **composition is reliable and monthly projections are weak.** Three things
matter here:

1. **This ticket's premise is confirmed, and sharpened.** `listLessons` is now **40.7%
   of the deployment's Database I/O** at 154 KB per call, while its two former peers
   collapsed: `capture.myQuestions` went from 1.15 GB/month to **530 KB**, and
   `listReferences` from 1.13 GB/month to **4.25 MB**. `784eb70` fixed those two and,
   exactly as this ticket predicted, could not make the lesson rows thin. Straight-lined
   `listLessons` is about 1.7 GB/month against a 1.16 GB baseline, so it is **not
   improving on its own**.

2. **`public.publicCourse` belongs to this ticket, and the `Done when` above is widened
   to say so.** It is the **new #2 line at 24.2% of the I/O and 257 KB per call, the
   worst per-call amplification in the deployment**, up from an unremarkable 59.65
   MB/month at baseline. It is the same defect: `convex/public.ts` calls
   `ed.map(["title", "lesson", "reference", "question"])`, the full four-kind Guest
   mirror, so it collects the fat `translations` rows and gained nothing from
   `784eb70` because it genuinely needs those kinds.

   **This is why the shape of the fix matters more than the ticket first said.** The
   sibling-table split proposed above fixes `listLessons`, `listReferences` and
   `publicCourse` together, because none of them wants the body. Any fix that works by
   narrowing declared kinds instead **cannot touch `publicCourse` at all**, and would
   therefore leave a quarter of the I/O in place while looking like a success on the
   other two. No separate ticket was filed: it is one fix, and splitting it would mean
   two migrations of one table.

3. **"Is this worth doing at all?" now has a real answer, and it depends on one
   decision that is not this ticket's.** Against, honestly: the whole bill is $3 to $4 a
   month, and Compute and Data Egress have collapsed to nothing (6 bytes of egress
   against a 2 GB baseline line), so the bill shrinks without this. For: `listLessons`
   plus `publicCourse` are **64.9% of the project's Database I/O between them**, far more
   concentrated than the baseline's three-way split, and the read is per (Topic,
   language) so Editions multiply it.

   **The thing that actually decides it, costed 2026-09-09 in
   [the baseline](../assets/convex-cost-baseline.md): this ticket and the EU-to-US move
   are complementary, not competing, and only the pair reaches a $0 bill.** Estimates:

   | Scenario | Estimated bill |
   |---|---|
   | EU today | ~$2.17/month |
   | US alone | ~$0.67/month |
   | EU + this ticket | ~$1.42/month |
   | **US + this ticket** | **~$0.09/month** |

   US hosting alone leaves I/O about 4x over the 1 GB included allowance, so it does not
   reach $0 on its own. This ticket is what pulls I/O down to where that allowance
   absorbs it. **So if the residency question goes the way of US hosting, this ticket
   stops being worth $0.60 and starts being worth the last dollar of the bill; if it
   stays EU, this is worth about $0.75/month and the honest answer may still be to close
   it out of scope.** That reverses the map's old framing that the US move competed with
   this work. The dollar figures rest on a 1.25-day window and rates derived from one
   invoice, so re-check them before acting.

## Done when

- A title-only query (`listLessons`, `listReferences`) **and `public.publicCourse`**
  read rows that do **not**
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
