# Handoff: Convex cost, and caching a course so it stops re-reading the database

**Date:** 2026-09-09 · **Previous session:** the `perceived-performance` map
(chartered `c696121`, tickets 01 to 06 built in PR #127). **This handoff is
planning only; no code was written for it.**

The want that produced it, in the operator's words: *"I really want users to
download/cache courses and thus not have to go to db every time."*

That want is right, and the route to it is not the obvious one. Read section 2
before designing anything.

## 0. What this session could and could not see

**It could not read the live bill.** No Convex dashboard or billing access from
here. Everything below comes from what is committed in the repo:

- [`convex-cost-baseline.md`](../maps/technical-foundation/assets/convex-cost-baseline.md),
  which carries invoice **RJDCQK-00001, Jul 8 to Aug 7 2026, $4.33**, broken down
  by line and by function.
- A mid-cycle dashboard read recorded in that same file on **2026-08-27**.

**The Aug 8 to Sep 8 cycle closed yesterday and nobody has read that invoice.**
It is the first closed bill that fully contains `784eb70` (the 2026-08-11
narrowing), so it is the first real test of that change. Read it before anything
else here; it may move several of the numbers below.

## 1. What the money actually is

$4.33 for the month. Database I/O was 59% of it. The projected next bill in the
baseline is **about $3.20**.

Say that plainly to whoever is deciding: **this is a three-to-four dollar a month
bill.** Nothing in this handoff is worth a session on cost grounds alone. Ticket
`technical-foundation/01`, the biggest named optimisation, is worth **about $0.60
a month**.

The reason to do this work is the **user experience** (a course that opens
instantly and reads offline on South African mobile data), not the invoice. If it
gets justified to anyone as a cost saving, it will be judged against $0.60 and
correctly rejected.

## 2. The correction that reframes the whole want

**Lesson bodies already do not come from the database.**

Since the content-blob migration, a Lesson or Reference body lives in file storage
and is served by `GET /content?id=<storageId>` (`convex/http.ts`) with
`Cache-Control: public, max-age=31536000, immutable` and no authentication at all.
Lesson rows carry `htmlStorageId`, not HTML. On the baseline invoice, **file
storage was $0.04, one percent of the bill.**

So a browser that has opened a lesson already holds its body for a year, off the
database path entirely, with no network on a repeat read. "Cache the course so we
stop hitting the DB" is, for the *content*, already true.

**What hits the database on every course open is the metadata**, and that is where
all the money is. From the by-function table:

| Function | I/O | What it is |
|---|---|---|
| `content/reader.listLessons` | 1.16 GB | the lesson table of contents |
| `capture.myQuestions` | 1.15 GB | the Q&A thread |
| `content/reader.listReferences` | 1.13 GB | the reference table of contents |
| `content/reader.getLesson` | 29.62 MB | one lesson's metadata plus a blob URL |
| `content/reader.courseHeader` | 28.05 MB | title, role, editions, paywall |

**Three functions were 95% of the attributed I/O, and all three read the table of
contents rather than any body.** The cause is recorded in the baseline: each
collects translation rows that carry a whole inline `translations.html`, to return
a line of text. `technical-foundation/01` owns the residual.

**So the thing worth caching locally is the table of contents, the header and
progress. Not the lesson HTML, which is already cached harder than anything we
could build.** A next session that starts by building a lesson-body downloader
will spend itself on the one part that is already solved.

## 3. The lever that beats every optimisation here, and it is not code

All deployments are **EU-hosted**, and EU usage cannot draw on the plan's included
allowances (Starter: 1M function calls, 1 GB I/O, 0.5 GB storage). Every unit
prices from the first one, at the Starter rate plus a 30% regional surcharge.
Verified against convex.dev/pricing on 2026-08-27.

**US-hosted deployments would draw on those allowances, and at this traffic that
is a $0 bill.** A configuration change, not a code change, worth more than every
ticket in the read-amplification thread combined.

It is not free: it moves data residency, and that is a question about the courses'
learners and POPIA, not about cost. It is already recorded as a floating fog patch
on the baseline with no `clears-with:` anchor.

**Decide this before spending a session on cost-motivated code.** If the answer is
"move to US", the cost argument for everything in section 5 evaporates and only
the user-experience argument remains, which is a different and better
conversation.

## 4. Do the attribution before the optimisation

The baseline invoice was **9 GB** of Database I/O. The by-function breakdown, in
the prod deployment, accounts for **3.62 GB**. **About 5.4 GB, roughly 60%, has
never been attributed to any function.** There are 9 deployments on the account.

The baseline's own instruction, and it still stands: drill Database I/O per
deployment (dashboard, Usage, Database I/O, the row chevron) **before** working
ticket 01, or the effort optimises the smaller half. The likeliest explanation is
the non-prod deployments, which in the EU bill at exactly the same rate as prod,
but that is a guess and the dashboard answers it directly.

This is a ten-minute dashboard read and it gates everything.

## 5. What already exists. Do not re-derive any of it

| Ticket | State (2026-09-09) | Subject |
|---|---|---|
| [technical-foundation/01](../maps/technical-foundation/tickets/01-slim-the-row-listlessons-collects.md) | open, on the frontier | slim the translation row `listLessons` collects. The 1.16 GB line. |
| [technical-foundation/04](../maps/technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md) | open grilling, no blockers | `/content` is an unauthenticated bearer URL, cacheable for a year |
| [technical-foundation/05](../maps/technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md) | open grilling, **blocked by 04** | offline Lesson content under a lease |
| [technical-foundation/22](../maps/technical-foundation/tickets/22-materialise-read-amplification.md) | open | what `materialiseTopic` collects |
| `installable-app/05` | **built** | the Offline Catalogue: the dashboard course *list*, last-known-good in `localStorage` |
| `perceived-performance/05` | built, PR #127 | in-memory body cache plus next-lesson warm, dies with the tab |

Three things a next session must not re-litigate, each already settled and each
costly to rediscover:

- **`translations.html` stays inline.** Decided 2026-08-04; the ticket that said
  otherwise had a stale "Done when", corrected in `078cb2c`. Blob storage is
  explicitly not the answer for translation rows.
- **The access objection to caching was aimed at the wrong target**, and
  `technical-foundation/05` records the reasoning in full. `/content` is already
  world-readable and revocation-proof, so caching does not introduce that
  exposure, it makes it convenient. The exposure itself is ticket 04.
- **Encryption is not the answer** and this was tested properly. The key must
  reach the device and the plaintext must render in a browser the learner
  controls. A lease without encryption delivers revocation within one lease
  period; encryption without a lease delivers none.

## 6. The genuine gap, and why no ticket was filed for it

Nothing owns **"cache a course's table of contents, header and progress on the
device, so a repeat open does not re-read the database"**. `technical-foundation/05`
is about bodies. `installable-app/05` is the dashboard list, one level up. The
per-course metadata, which is where 95% of the I/O is, is unowned.

Proposed shape, for whoever charters it:

> **Question.** Convex queries are live subscriptions, not fetches: the read
> happens on open and again on every invalidation, and that reactivity is what
> makes the reader correct when a lesson is published or an Edition is granted.
> A local cache of the table of contents trades some of that away. What is the
> right trade: render the cached ToC immediately and let the subscription correct
> it (stale-while-revalidate, no reads saved but a faster open), or hold the
> subscription back behind a freshness check (reads saved, staleness visible)?
> They are different features and only the second touches the bill.

**No ticket was filed, deliberately.** Two of its premises are still open:
section 3 may remove the cost motivation entirely, and section 4 means we do not
yet know that the reader path is even the majority of the I/O. Charter it once
those two are answered, and it will be a much sharper ticket than it can be
today.

## 7. Suggested order

1. **Read the Aug 8 to Sep 8 invoice.** First closed bill containing `784eb70`.
2. **Drill I/O per deployment** and find the unattributed 60% (section 4).
3. **Decide EU versus US** (section 3). This may end the cost thread.
4. **Then, and only then,** decide whether `technical-foundation/01` is worth
   doing, or is out of scope at $0.60 a month.
5. **Separately, on user-experience grounds and not cost:** resolve
   `technical-foundation/04`, which unblocks `05`, and charter the ToC-caching
   ticket in section 6.

Steps 1 to 3 are a single short session and are mostly dashboard reading, not
code. Do not let a session start at step 4.

---

## 8. What was executed against this handoff, 2026-09-09

Same day it was written, in one session. **Steps 1 to 3 of section 7 were NOT done,
and cannot be done from a checkout.** Everything that was not gated on them was.

### Blocked, and now recorded as blocked rather than un-worked

Steps 1, 2 and 3 all need a Convex **dashboard** read. Verified rather than assumed:
`npx convex --help` on 1.45.0 exposes no usage or billing command (`dev`, `deploy`,
`run`, `data`, `insights`, `env`, ... and nothing for the invoice), and this checkout
has no prod deploy key. So they need the **operator**, not another session.

They are now written into the technical-foundation map's `## Notes` as
operator-gated, with the standing instruction not to start a cost-motivated code
session before them, so the next session does not re-plan them or quietly build
around them.

### Step 1's cheap half was closed anyway

The invoice is unread, but the baseline's **candidate explanation 1** for why the
mid-cycle read came in 17% down instead of the estimated 58%, namely *"`784eb70` may
not be live in prod"*, is answerable from git and is now **ruled out**. It is live:
`784eb70` is an ancestor of `origin/main` with 331 commits after it, and every one of
those pushes ran `npx convex deploy --cmd 'pnpm run build'` (recorded in `README.md`,
`docs/routine.md` and `docs/agents/project-context.md`, and confirmed against a real
Vercel build log on 2026-07-29). Prod has been running the narrowed `map()` for
essentially the whole Aug 8 to Sep 8 cycle.

That leaves **candidate 2 as the standing explanation**, and it was re-verified in the
code on 2026-09-09: `listLessons` still calls `loadEdition(...).map(["lesson"])` at
`convex/content/reader.ts:226`. Recorded in the baseline.

### Ticket 22's unconditional half is done

Its first `Done when` was explicitly *"true regardless of what is decided below"*, so
it needed nothing from steps 1 to 3. The stale `ponytail:` marker above
`collectTopicContext` is corrected in the tree with an absolute date. **Two things
were stale, not one:** the claim itself (no Lesson HTML crosses that query, and the
header sentence "Lessons + References (with HTML)" was wrong the same way), and
**this handoff's and the ticket's own line number**, which said `convex/routine.ts:838`
when the marker is at **933**.

Ticket 22 stays **open**: its second `Done when` is the measured call, and nothing
here measured anything.

### Section 6's ticket was filed after all, as
[technical-foundation/38](../maps/technical-foundation/tickets/38-cache-a-course-toc-on-the-device.md)

This reverses section 6's "no ticket was filed, deliberately", and the reason is that
section 6 and section 7 step 5 disagree. Section 6 withholds the ticket until sections
3 and 4 are answered; step 5 says to charter it *"separately, on user-experience
grounds and not cost"*. Both of section 6's open premises are **cost** premises, so
under step 5's framing they gate the reads-saved half of the question only, not the
question. Step 5 is the more specific instruction and it is the one followed.

38 carries the section 6 question verbatim as its `## Question`, plus the section 2
correction (bodies are already cached, the metadata is the cost), the section 5 table
of what exists, and both premises written down as operator-gated so nobody re-derives
them. It also names something section 6 did not: 38's reads-saved option and ticket
**01 are two routes to the same 1.16 GB** and may substitute for each other, so they
should be priced against each other rather than both built.

### Not done, and why

- **Step 4** (is 01 worth doing) is gated on steps 1 to 3 by this handoff's own
  instruction: *"do not let a session start at step 4."* Untouched.
- **Step 5's other half, resolving [04](../maps/technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md)**,
  is a genuine decision for the operator, not an agent: it trades a year-long
  `immutable` cache and permanent shareable lesson URLs against POPIA-adjacent
  exposure on paid content, for a product with around ten lifetime sales. 04 already
  has its prod evidence gathered (2026-09-04) and is on the frontier. It needs a
  human to pick, not more research.

---

## 9. The dashboard read arrived, same day

The operator supplied the by-function screenshots that section 0 said this session
could not get. **Step 2 of section 7 is substantially done and step 1 is not** (these
are cycle-to-date figures, not the closed invoice). Full table and derivation in
[the baseline](../maps/technical-foundation/assets/convex-cost-baseline.md).

**The window is about a day and a half**, derived rather than given: the screenshots
carry no date range, but they show 9.3K function calls, and the Aug 8 to Sep 8 cycle
had already logged 204K by 2026-08-27. So this is the cycle that opened 2026-09-08.
Composition is reliable; monthly projections from it are not.

**Two of this handoff's numbers are dead, and one of its conclusions with them.**
Section 2 rested on three functions being 95% of the I/O and all reading a table of
contents. The table-of-contents point stands. The three functions do not:
`capture.myQuestions` has fallen from **1.15 GB/month to 530 KB** and
`content/reader.listReferences` from **1.13 GB/month to 4.25 MB**, both fixed by
`784eb70` with no caching involved. `listLessons` is untouched and now dominant at
40.7%. So **one of the three motivating numbers for the ToC cache evaporated between
this handoff being written and being worked**, which is recorded on ticket 38.

**A line this handoff never mentioned is now the #2 cost.** `public.publicCourse`, at
24.2% of the project's I/O and **257 KB per call**, the worst per-call amplification in
the deployment, up from an unremarkable 59.65 MB/month. It is the same defect ticket 01
is about, on the Guest path: it declares the full four-kind Edition mirror, so
`784eb70` could not help it. **Ticket 01's `Done when` has been widened to include it**,
because the sibling-table split fixes all three reads at once whereas a
kinds-narrowing fix would leave a quarter of the I/O in place while appearing to
succeed. No new ticket: it is one fix and one migration.

**Section 4's hypothesis got weaker.** The likeliest explanation for the unattributed
~60% was the non-prod deployments. Inside the `my-course` project non-prod is **0.4%**
(Dev 660.7 KB of 166.97 MB). The other projects on the account were not visible.

**Two bill lines have stopped mattering.** Data Egress is **6 bytes** against a 2 GB /
$0.34 baseline line, and Compute is 0.00309 GB-hours against 1 GB-hour / $0.43. The
bill is shrinking without any of the work in section 5.

**Still outstanding, and unchanged in priority:** the closed Aug 8 to Sep 8 invoice
(step 1), and **EU versus US hosting** (step 3), which remains the largest single lever
and which none of this touches.
