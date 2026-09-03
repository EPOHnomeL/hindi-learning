---
type: task
blocked_by: []
---
# What `materialiseTopic` actually collects, and the stale marker above it

## Question

Filed 2026-09-03 out of [20](20-ponytail-debt-ledger.md), the ponytail debt harvest,
which flagged this marker as one of three load-bearing ones and then found the marker
itself to be **factually stale**.

The `ponytail:` comment at `convex/routine.ts:838` says the query "returns all Lesson
HTML in one query". It does not, and has not since the content-blob migration: Lesson
rows carry no HTML at all (`convex/schema.ts:195` has `htmlStorageId` only), and
`collectTopicContext` returns a signed `htmlUrl` per lesson rather than a body. So this
is **not** ticket [01](01-slim-the-row-listlessons-collects.md)'s read-amplification
family, and anyone reasoning from the comment is reasoning from a world that is gone.

What the harvest found is genuinely fat there, and it is different:

- **`learningRecords.markdown` is collected in full**, every record, whole.
- **Whole `questions` and `responses` collects**, unpaginated.

The mitigating fact, and the reason this is a task rather than an emergency: it runs
**once per materialise run**, not per page view. That is a very different cost profile
from `listLessons`, which 01 is about, and it may well be the correct answer to leave it
alone. Say which.

## Done when

Two things, and the first is cheap:

- The stale marker at `convex/routine.ts:838` is corrected in the tree so it describes
  what the query actually reads today, with an absolute date. This is true regardless of
  what is decided below.
- A measured call on the real reads: how big `learningRecords.markdown` and the
  `questions` / `responses` collects actually get on the largest live Topic, how often a
  materialise run happens, and therefore whether anything needs paginating at all. A
  resolution of "measured, and it is fine, here are the numbers" is a good outcome; a
  resolution with no numbers is not.
