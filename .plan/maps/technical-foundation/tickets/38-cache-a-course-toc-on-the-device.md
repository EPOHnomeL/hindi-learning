---
type: grilling
blocked_by: []
---
# Cache a course's table of contents on the device

## Question

Convex queries are **live subscriptions, not fetches**: the read happens on open and
again on every invalidation, and that reactivity is what makes the reader correct when
a lesson is published or an Edition is granted. A local cache of the table of contents
trades some of that away.

**What is the right trade: render the cached ToC immediately and let the subscription
correct it (stale-while-revalidate, no reads saved but a faster open), or hold the
subscription back behind a freshness check (reads saved, staleness visible)?**

They are different features and **only the second touches the bill.** A session that
builds one while quoting the other's justification has built the wrong thing.

Chartered 2026-09-09 from section 6 of
[the Convex-cost handoff](../../../handoffs/2026-09-09-convex-cost-and-course-caching.md),
which shaped the question but deliberately filed no ticket. It is filed now on the
grounds that handoff's own step 5 gives: **user experience, explicitly not cost.** A
course that opens instantly and reads on South African mobile data is worth deciding
regardless of the invoice, and the two premises the handoff was waiting on are both
cost premises (see `## The premises this does and does not depend on`).

## Why the obvious version of this want is already built

The operator's words were *"I really want users to download/cache courses and thus not
have to go to db every time"*. **For lesson bodies that is already true**, and a
session that starts by building a body downloader will spend itself on the one part
that is solved. Verified in the tree on 2026-09-09:

- `lessons` rows carry `htmlStorageId` and no `html` (`convex/schema.ts:204`). Bodies
  live in file storage.
- `GET /content?id=<storageId>` (`convex/http.ts:149`) serves them with
  `Cache-Control: public, max-age=31536000, immutable` (`:164`). A browser that has
  opened a lesson holds its body for a year, with no network on a repeat read and no
  database involvement at all.
- On invoice RJDCQK-00001, **file storage was $0.04, one percent of the bill.**

**What actually hits the database on every course open is the metadata.** From the
by-function breakdown in [the baseline](../assets/convex-cost-baseline.md), three
functions were **95% of the attributed I/O** and all three read a table of contents
rather than any body: `content/reader.listLessons` (1.16 GB),
`capture.myQuestions` (1.15 GB), `content/reader.listReferences` (1.13 GB), with
`courseHeader` at 28.05 MB behind them.

So the thing worth caching on the device is **the table of contents, the header and
progress**, not the lesson HTML, which is already cached harder than anything we would
build.

## What already exists, so none of it is re-derived

| Owner | State (2026-09-09) | Scope |
|---|---|---|
| `installable-app/05` | **built** | the Offline Catalogue: the dashboard course *list*, last-known-good in `localStorage`. One level **up** from a course. |
| `perceived-performance/05` | **built**, PR #127 | in-memory body cache plus next-lesson warm. **Dies with the tab.** |
| [05](05-offline-lesson-content-under-a-lease.md) | open grilling, blocked by [04](04-content-route-is-an-open-bearer-url.md) | offline lesson **bodies** under a lease. |
| [01](01-slim-the-row-listlessons-collects.md) | open, on the frontier | make the collected row thin **server-side**. The other way to attack the same 1.16 GB. |

**The per-course metadata, which is where 95% of the I/O is, is unowned.** That gap is
this ticket. Note that [01](01-slim-the-row-listlessons-collects.md) and the
reads-saved option here are two routes to one number and may substitute for each
other: 01 makes each read cheap, this makes the read not happen. Price them against
each other rather than doing both blindly.

## What a grilling has to settle

- **Which of the two features is wanted**, named as such. Faster open, or fewer reads.
- **What invalidation correctness requires.** A learner granted an Edition, or a lesson
  published mid-course, must not be stuck behind a stale ToC. Which of these must be
  immediate and which may lag by a cache period?
- **The freshness check, if it is the second option.** What is cheap enough to ask on
  every open to be worth skipping the full read? A single-row version or `updatedAt`
  probe is the obvious shape, but nothing in the tree provides one today, and a probe
  that costs a full `loadEdition` saves nothing.
- **Where it is stored, and how it is bounded.** `installable-app/05` chose
  `localStorage` for the dashboard list. A per-course ToC is bigger and there is more
  than one course.
- **What happens to progress**, which is per-learner and written, not read-only like a
  ToC. It may not belong in the same mechanism at all.
- **Whether it is worth it for this learner base**, whose lifetime sales are around
  ten. The honest options include ruling it out.

## The premises this does and does not depend on

The handoff withheld this ticket because two of its premises were open. Both are
**cost** premises, which is why the ticket is filed on user-experience grounds and why
they gate the *reads-saved* half only:

- **EU versus US hosting.** All deployments are EU-hosted and cannot draw on the plan's
  included allowances; US hosting would, and at this traffic that is a $0 bill. A
  configuration change worth more than every optimisation on this map combined. If that
  is chosen, the cost argument for the reads-saved option evaporates and only the
  faster-open argument remains.
- **The unattributed ~60% of Database I/O.** The baseline invoice was 9 GB; the
  by-function breakdown accounts for 3.62 GB, filtered to prod, and there are 9
  deployments. Until that is drilled, we do not know the reader path is even the
  majority of the I/O.

Both are dashboard reads and **neither can be done from a checkout** (verified
2026-09-09: the Convex CLI has no usage or billing command, and this checkout has no
prod deploy key). They need the operator. Both are already recorded as fog on the map.

**Say plainly to whoever decides this: the whole bill is $3 to $4 a month, and ticket
01, the largest named optimisation, is worth about $0.60 of it.** Nothing here is worth
a session on cost grounds. Justified as a cost saving it will be judged against $0.60
and correctly rejected. The reason to do it is the reader that opens instantly.

## Done when

One of the two features is chosen and named, or the ticket is ruled out with the
reason recorded. If chosen: the invalidation rule is written down (what may lag and
what may not), the freshness mechanism is specified if reads are meant to be saved,
progress is either in scope or explicitly excluded, and the relationship to
[01](01-slim-the-row-listlessons-collects.md) is stated so the two are not built
twice for one number. Implementation tickets exist, or the ruling-out stands.
