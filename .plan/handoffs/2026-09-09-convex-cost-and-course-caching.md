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
