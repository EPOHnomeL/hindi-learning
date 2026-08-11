# Convex cost: DB I/O read amplification

## Destination

Convex Database I/O back to a size the free tier absorbs, by removing **read
amplification** — queries reading far more bytes than they return — without turning
off a single feature.

The bar is a measurement, not a feeling: the next monthly bill's Database I/O line,
read against the baseline in Notes below.

## Notes

**This map carries BUILD tickets, not just decisions.** Stated here because
wayfinder's default is plan-don't-do and the override lives in Notes. Each ticket
here ships code.

### The measured baseline — Jul 8 – Aug 7 2026, invoice RJDCQK-00001, $4.33

Charge by line, so effort goes where the money is:

| Line | Amount | Share |
|---|---|---|
| **Database I/O** (9 GB) | **$2.57** | **59%** |
| Function calls (229,987) | $0.66 | 15% |
| Action compute (1 GB-hour) | $0.43 | 10% |
| Data egress (2 GB) | $0.34 | 8% |
| Database storage (1 GB) | $0.29 | 7% |
| File storage (1 GB) | $0.04 | 1% |

Database I/O by function (dashboard → Usage → Database I/O → by function), prod,
3.62 GB attributed:

| Function | I/O |
|---|---|
| `content/reader.listLessons` | 1.16 GB |
| `capture.myQuestions` | 1.15 GB |
| `content/reader.listReferences` | 1.13 GB |
| `public.publicCourse` | 59.65 MB |
| `content/reader.getLesson` | 29.62 MB |
| `translate.publishTranslation` | 28.14 MB |
| `content/reader.courseHeader` | 28.05 MB |
| everything else | < 7 MB each |

**Three functions were 95% of it.** That concentration is the whole reason this map
is small: there is no broad inefficiency to hunt, there is one mistake in one seam.

### The cause, and what already landed before this map existed

All three read `loadEdition().map()`, which collected **every** translation row for an
Edition and returned a snapshot used only for titles and question text. A `lesson` or
`reference` translation row carries a whole inline HTML body (`translations.html`), so
each list query paid for the entire Edition's bodies to render a line of text.

`784eb70` (2026-08-11) made `map()` take the kinds it may read, one indexed range scan
per kind over the `kind` prefix of `by_topic_lang_kind_key`. That is expected to cut
`myQuestions` to near zero and `listReferences` to 23 rows instead of 155 — **an
estimated 58%, NOT yet confirmed against a bill.** Ticket 01 owns the residual.

### Do not migrate `translations.html` to blob storage

That was decided against on 2026-08-04 and the ticket that said otherwise
(`course-translation/05`) had a stale "Done when", corrected in `078cb2c`. Inline
`html` is the settled shape. Ticket 01 is deliberately shaped to leave that decision
standing.

### Skills

`convex:convex-performance-audit`, `convex:convex-migration-helper`,
`convex:convex-expert`, `/tdd`, `/ponytail`.

## Decisions so far

<!-- the index of resolved tickets — empty until 01 lands an ## Answer. The pre-map
     commits (784eb70, 078cb2c) are described in Notes above, since this section may
     only reference resolved TICKETS. -->

## Not yet specified

- **Whether 01 is needed at all.** It is worth ~$0.60/month at current traffic. If the
  next bill shows `listLessons` already acceptable, the right answer may be to do
  nothing and close 01 out of scope. `clears-with: 01`
- **Whether the residual scales with Editions or with readers.** This read is per
  (Topic, language), so each new Edition multiplies it — `app-language-i18n`,
  `hindi-devanagari-edition` and `urdu-chrome-locale` all add Editions. Unclear which
  term dominates until more than one non-English Edition sees real traffic.

## Out of scope

Ruled out by **measurement**, so a later session does not re-audit them. A static
read of the code flags all of these as real inefficiencies; the bill says they cost
nothing. Numbers are from the by-function table above.

- **The `dashboard` N+1** (`content/reader.dashboard`, full `lessons` + `progress`
  collects per card via `progressCounts.topicLessonCounts`) — **4.16 MB/month.**
  Denormalising the counts would save fractions of a cent.
- **Fat `resources.processed` rows read by `listResources`** — **861.9 KB/month.**
- **`collectTopicContext` reading every `learningRecords.markdown` per authoring
  fire** (`routine.materialiseTopic`) — **1.24 MB/month.** This was the leading
  alternative hypothesis for the 9 GB and the breakdown killed it.
- **Missing indexes on `generation`, `translationJobs`, `whitelist`, `tenants`,
  `sellers`** — these tables are small; none appears above 7 MB. Add one only if a
  table grows, not on principle.
- **Function calls, action compute, storage** — $0.66 / $0.43 / $0.33 respectively.
  Narrowing `dailyFire`'s full `topics` scan and deleting the orphaned lesson blobs
  that `content/publish.ts` leaves behind are both real, both cost cents. Out of
  scope *for this map*, whose destination is Database I/O.
