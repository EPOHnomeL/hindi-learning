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

1. **`784eb70` may not be live in prod. RULED OUT 2026-09-09.** It landed 2026-08-11,
   three days into this cycle, and the doubt was worth checking because it was cheap.
   It is live. `git merge-base --is-ancestor 784eb70 origin/main` passes and **331
   commits** sit on `origin/main` after it, so `main` has been pushed many times since
   the change landed. The build command that every one of those pushes ran is
   `npx convex deploy --cmd 'pnpm run build'`, which is recorded in three independent
   places in the tree (`README.md`, `docs/routine.md`,
   `docs/agents/project-context.md`) and confirmed against a real Vercel build log on
   2026-07-29 (`.scratch/docs-reconciliation/FINDINGS.md`). So prod has been running
   the narrowed `map()` for essentially the whole Aug 8 to Sep 8 cycle.

   Two honest limits, so this is not over-read: it is verified from git plus the
   recorded build command, **not** by querying the prod deployment, because this
   checkout still has no prod deploy key. And it does not explain the gap, it only
   removes the cheap explanation for it.
2. **The residual is exactly what ticket 01 predicted. Now the STANDING explanation,
   candidate 1 having been ruled out (2026-09-09).** Re-verified by reading the code
   on 2026-09-09: `listLessons` still calls `loadEdition(...).map(["lesson"])` at
   `convex/content/reader.ts:226`, and `listReferences` the same with `["reference"]`
   at `:258`. Nothing has changed on that path. Originally: verified by reading the code
   on 2026-08-27: `listLessons` still calls `loadEdition(...).map(["lesson"])`
   (`convex/content/reader.ts`), and `lessonsToc` reads one whole inline
   `translations.html` body per lesson to return one title string. The narrowing in
   `784eb70` removed the other four kinds; it could not make the lesson rows thin.

### The 2026-09-09 dashboard read, by function, all deployments in `my-course`

Supplied by the operator as four dashboard screenshots (Function Calls, Database I/O,
Compute, Data Egress), which is the read this map had been unable to get. **This is the
first by-function data since the baseline, and it changes the ranking.**

**Period and scope, CONFIRMED by the operator's dashboard on 2026-09-09:** the range
selector reads **Sep 08, 2026 to Oct 08, 2026** and the project selector reads **All
Projects**. So this is the open cycle, read on its second day, across every project on
the team. Two things follow, and the second is the more useful:

- **The window is about 1.25 days**, cross-checked two independent ways that agree to
  0.4%: 9,300 function calls against the baseline's 229,987 per month is a factor of
  **24.7**, and 1.25 elapsed days of a 31-day cycle is a factor of **24.8**. That
  agreement is also evidence the traffic in the window is *representative* rather than
  a spike, since calls per day match the baseline month almost exactly. Multiply by
  **24.7** for a monthly figure.
- **It is NOT prod-filtered and NOT project-filtered.** The baseline's by-function
  table was filtered to prod, which is where its unattributed 60% came from. This one
  is not, which is why it can speak to that question at all (see below).

**Treat the composition as reliable and the projection as weak.** A day-and-a-half
window is a bad basis for a monthly number, and this particular window contains a
translation run (`publishTranslation` and `publishTranslationChecked` at 261 calls
each), which is bursty rather than steady traffic.

Database I/O, project total **166.97 MB**:

| Function | I/O | Calls | Per call | Baseline |
|---|---|---|---|---|
| `content/reader.listLessons` | **67.92 MB** (40.7%) | 441 | 154 KB | 1.16 GB/mo |
| `public.publicCourse` | **40.36 MB** (24.2%) | 157 | **257 KB** | 59.65 MB/mo |
| `translate.publishTranslation` | 10.41 MB | 261 | 40 KB | 28.14 MB/mo |
| `certificates.myCertificate` | 7.67 MB | **1.1K** | 7 KB | not listed |
| `content/reader.dashboard` | 4.81 MB | | | 4.16 MB/mo |
| `content/reader.courseHeader` | 4.66 MB | 414 | 11 KB | 28.05 MB/mo |
| `content/reader.listReferences` | 4.25 MB | 230 | 18 KB | **1.13 GB/mo** |
| `dashboard.courseStats` | 2.94 MB | | | not listed |
| `capture.myProgress` | 2.65 MB | 274 | | not listed |
| `catalogue.list` | 2.47 MB | | | not listed |
| `routine.materialiseTopic` | 1.23 MB | | | 1.24 MB/mo |
| `capture.myQuestions` | **530.23 KB** | 132 | 4 KB | **1.15 GB/mo** |
| `content/reader.dashboard` (Dev) | 660.7 KB | 298 | | |

#### What this settles

- **`capture.myQuestions` is FIXED.** 1.15 GB/month to 530 KB in a day and a half, from
  the bill's #2 line to about #23. `784eb70` did exactly what it was expected to do
  here. Whatever the period, that is a collapse of two to three orders of magnitude.
- **`content/reader.listReferences` is largely fixed.** 1.13 GB/month to 4.25 MB, now
  #7. The 23-rows-instead-of-155 prediction in `784eb70`'s notes holds up.
- **`content/reader.listLessons` is NOT fixed and is now dominant**, at 40.7% of the
  deployment's I/O and 154 KB per call. Exactly what ticket 01 predicted: the narrowing
  removed the other kinds and could not make the lesson rows thin. Straight-lined it is
  about **1.7 GB/month, worse in absolute terms than the 1.16 GB baseline**. Read that
  as "not improving" rather than as a precise regression, given the window, and note it
  is consistent with the open question of whether this read scales with Editions, which
  have been added since.
- **Compute and Data Egress have essentially gone to zero.** Egress is **6 bytes**
  total against a 2 GB / $0.34 baseline line; compute is 0.00309 GB-hours against 1
  GB-hour / $0.43, and even at 25x that is 0.077. Two of the six bill lines have
  stopped mattering. Top compute line is `translate.publishTranslationChecked`.

#### Two findings the baseline did not have

- **`public.publicCourse` is the new #2 line and nothing owns it.** 24.2% of the I/O at
  **257 KB per call, the worst per-call amplification in the list**, up from a barely
  noticeable 59.65 MB/month. The cause is the same one ticket 01 is about: it calls
  `ed.map(["title", "lesson", "reference", "question"])` (`convex/public.ts`), the
  full four-kind Guest mirror, so it collects the same fat `translations` rows and gets
  no benefit from the `784eb70` narrowing because it genuinely declares the fat kinds.
  **Ticket 01's `Done when` named only `listLessons` and `listReferences`**, and has
  been widened to include this, because the table split fixes all three at once while a
  kinds-narrowing fix would miss a quarter of the I/O.
- **`certificates.myCertificate` is the chattiest function in the deployment**, 1.1K
  prod calls plus 298 dev, well above `listLessons`'s 441. Cheap per call (7 KB), so it
  is a function-calls question rather than an I/O one, and function calls were 15% and
  $0.66 of the baseline bill. The cause is structural: `CertificateChip` mounts its own
  `useQuery(api.certificates.myCertificate)` per course card
  (`src/app/_components/CourseCardParts.tsx:97`), so one dashboard load fans out one
  subscription per card. Recorded as fog on the map, not ticketed.

#### What it does NOT settle

- **The unattributed share.** This read is one project, `my-course (hindi-learning)`,
  and the account reportedly has 9 deployments. Within this project, **non-prod is
  negligible**: Dev is 660.7 KB of 166.97 MB, about 0.4%. That **weakens the leading
  hypothesis** for the missing 60%, which was that the non-prod deployments explain it.
  Other projects were not visible in the screenshots.
- **The invoice is still unread.** These are dashboard cycle-to-date figures, not a
  closed bill, so the actual Aug 8 to Sep 8 charge is still unknown.
- **EU versus US hosting**, which remains the largest single lever and is untouched by
  any of this.

### What US hosting would actually cost, and why "$0 bill" was too optimistic

**Corrected 2026-09-09.** This file and the technical-foundation map both said US
hosting would be "a $0 bill" at this traffic. **At the I/O this read projects, it would
not be.** The arithmetic below is derived from this file's own invoice rather than from
a pricing page, and it changes the recommendation in a way that matters.

The mechanism is confirmed from the dashboard itself now, not just from
convex.dev/pricing. The Usage page carries this banner verbatim:

> **EU region usage is billed on-demand.** Included plan limits only apply to US-hosted
> deployments. All usage on EU deployments is charged at on-demand rates, plus a 30%
> regional surcharge.

Projected monthly figures, at the 24.7 factor derived above:

| Line | Projected | Starter allowance | US verdict |
|---|---|---|---|
| Database I/O | **4.03 GB** | 1 GB | **3.03 GB over** |
| Function calls | 230K | 1M | within, $0 |
| Database storage | ~137 MB | 0.5 GB shared | within |
| File storage | ~338 MB | 0.5 GB shared | within |
| Compute | 0.076 GB-hours | n/a | negligible |
| Data egress | 148 B | n/a | negligible |

Rates derived from this file's own invoice: $2.57 for 9 GB is **$0.286/GB** with the
30% surcharge, so **$0.220/GB** without it.

| Scenario | Estimated bill |
|---|---|
| **EU today** | ~$2.17/month |
| **US, nothing else changed** | **~$0.67/month** (I/O overage only) |
| EU + ticket 01 | ~$1.42/month |
| **US + ticket 01** | **~$0.09/month** |

**The consequence, and it reverses how this file framed the choice.** The map said US
hosting "competes with this entire map". It does not: **the two are complementary, and
only together do they reach ~$0.** Moving to US alone leaves I/O 4x over its allowance,
so the bill lands at about $0.67 rather than nothing. Ticket 01 alone, in the EU, saves
about $0.75 and leaves a bill. **Ticket 01 is what pulls I/O near the 1 GB allowance
the US move unlocks**, and 01 now covers 64.9% of the I/O (`listLessons` 40.7% plus
`public.publicCourse` 24.2%), which is what makes the combination work.

Three honest limits on all of the above:

- **The projection rests on a 1.25-day window**, and that window contains a translation
  run. The two calibrations agreeing is reassuring about the traffic being typical, not
  proof of it.
- **The rates are derived from one invoice**, not verified against convex.dev/pricing in
  this session, and the allowance figures are this file's own (1M calls, 1 GB I/O, 0.5
  GB storage). Re-check before anyone acts on the dollar figures.
- **Storage headroom on US is tight.** 137 MB database plus 338 MB file storage is 475
  MB against a 512 MB allowance. It fits today with about 7% to spare; it would start
  billing storage too if content grows.

**None of this decides the question**, which is data residency and POPIA for the
courses' learners, not cents. It only makes the cost side of it honest: the prize for
moving is about **$1.50/month today, or the whole bill if ticket 01 ships with it.**

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
- **Whether moving deployments to a US region beats every optimisation here. Costed
  2026-09-09, and the answer is "no, it COMPLEMENTS them".** See the section above: the
  "$0 bill" figure below was too optimistic, and US hosting alone lands at about $0.67
  because I/O stays 4x over its allowance. Original text follows. US
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
