<!-- NOT A MAP. This was `.plan/maps/technical-foundation/assets/convex-cost-baseline.md` until 2026-09-01, when the
     `.plan` consolidation took 33 map directories down to 7 active maps. Its only ticket
     had already moved to technical-foundation/01 on the same day, leaving a map with no
     tickets, which chartr renders as a live but empty card. Kept verbatim below because
     ticket 01 reasons from the measured baseline in it, and a measurement is the one
     thing a later session cannot re-derive from the code. Read it as evidence, not as a
     destination: the `## Not yet specified` and `## Out of scope` sections were that
     map's, and the live parts of both are now on the technical-foundation map itself. -->

# Convex cost: the measured Database I/O baseline

<!-- original H1: "Convex cost: DB I/O read amplification" -->
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

### The mid-cycle read, 2026-08-27 (cycle Aug 8 to Sep 8 2026, partial)

Dashboard Usage, 19 days into a 31-day cycle, so these are cycle-to-date figures and
not a closed invoice. Recorded here because the 58% above is still an estimate and
this is the first evidence against it.

| Line | Cycle to date | Straight-line to Sep 8 | Jul 8 to Aug 7 |
|---|---|---|---|
| **Database I/O** | **4.61 GB** | **~7.5 GB** | 9 GB |
| Function calls | 204K | ~333K | 229,987 |
| Action compute | 0.0093 GB-hours | ~0.015 GB-hours | 1 GB-hour |
| Database storage | 137.39 MB | roughly flat | 1 GB |
| File storage | 338.15 MB | roughly flat | 1 GB |
| Data egress | 108.78 MB | ~177 MB | 2 GB |

**About 17% off, not the estimated 58%.** Two candidate explanations, in the order
they should be checked:

1. **`784eb70` may not be live in prod.** It landed 2026-08-11, three days into this
   cycle. `.scratch/docs-reconciliation/FINDINGS.md` records that pushing `main` runs
   `npx convex deploy` inside the Vercel build, so it very probably is live, but that
   is inference and not a verified push. Cheapest thing to rule out first.
2. **The residual is exactly what ticket 01 predicted.** Verified by reading the code
   on 2026-08-27: `listLessons` still calls `loadEdition(...).map(["lesson"])`
   (`convex/content/reader.ts`), and `lessonsToc` reads one whole inline
   `translations.html` body per lesson to return one title string. The narrowing in
   `784eb70` removed the other four kinds; it could not make the lesson rows thin.

### Roughly 60% of the I/O has never been attributed to a function

Stated plainly because it is easy to miss in the baseline table above, and it is
larger than all three hot functions combined: the invoice was **9 GB**, the
by-function breakdown accounts for **3.62 GB**, and that view was filtered to **prod**.
About **5.4 GB has no named cause**. There are 9 deployments on this account.

No amount of reader-path optimisation touches that share. Drill Database I/O per
deployment (dashboard, Usage, Database I/O, the row chevron) before spending a session
on ticket 01, or the map risks optimising the smaller half.

### Every row now bills as on-demand overage (EU hosting)

All deployments are EU-hosted, and EU usage cannot draw on the plan's included
allowances (Starter: 1M function calls, 1 GB I/O, 0.5 GB DB storage), so the dashboard
`Included` column reads `0 / ...` and every unit prices from the first one at the
Starter rate plus a 30% regional surcharge. Rates verified against convex.dev/pricing
on 2026-08-27.

That cuts both ways for this map. The projected bill is only about **$3.20**, so the
absolute stake is smaller than the $4.33 baseline implies, though I/O is still about
two thirds of it. But the destination as written ("back to a size the free tier
absorbs") is **unreachable while the deployments stay in the EU** at any level of
optimisation, because there is no free tier to fall back into. See the new fog patch.

### Skills

`convex:convex-performance-audit`, `convex:convex-migration-helper`,
`convex:convex-expert`, `/tdd`, `/ponytail`.

- **Moved out 2026-09-01 to the [technical-foundation map](../../technical-foundation/map.md)**, which now groups this repo’s scalability, refactoring and code-architecture work:
  - `convex-cost/01` [Slim the translation row `listLessons` collects](../../technical-foundation/tickets/01-slim-the-row-listlessons-collects.md), now **01** there.
  
    That was this map’s **only** ticket, so nothing is left here to work. The effort is not abandoned: its subject is now the read-amplification thread on the technical map, and the billing baseline table in this map’s Notes above is still the reference the moved ticket points back to. Do not mint a new 01 here.
  
    Renumbering was forced: `blocked_by` is map-local, and the numbers collided across the twelve donor maps. **Do not reuse the old numbers here**, they remain those tickets’ identity in this map’s history.

## Decisions so far

<!-- the index of resolved tickets — empty until 01 lands an ## Answer. The pre-map
     commits (784eb70, 078cb2c) are described in Notes above, since this section may
     only reference resolved TICKETS. -->

## Not yet specified

- **Whether 01 is needed at all.** It is worth ~$0.60/month at current traffic. If the
  next bill shows `listLessons` already acceptable, the right answer may be to do
  nothing and close 01 out of scope. Partly answered on 2026-08-27: the
  mid-cycle read is in Notes, and it did NOT show `listLessons` fixed.
  `clears-with: 01`
- **Whether the residual scales with Editions or with readers.** This read is per
  (Topic, language), so each new Edition multiplies it — `app-language-i18n`,
  `hindi-devanagari-edition` and `urdu-chrome-locale` all add Editions. Unclear which
  term dominates until more than one non-English Edition sees real traffic.

- **Where the unattributed ~5.4 GB actually is.** 60% of the baseline invoice's I/O
  was never traced to a prod function (see Notes). Until it is, the map cannot claim to
  know what drives its own destination metric. Likeliest candidate is the non-prod
  deployments, which in the EU bill at exactly the same rate as prod, but that is a
  guess and the dashboard answers it directly.
- **Whether moving deployments to a US region beats every optimisation here.** US
  usage draws on the included allowances; at this traffic that is a $0 bill, versus the
  cents that ticket 01 is worth. It is a configuration change, not a code change, and
  it competes with this entire map. Not free: it moves data residency, and that is a
  question about the courses' learners rather than about cost. Uncosted, undecided, and
  deliberately floating with no `clears-with:` because no ticket here sharpens it.

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
