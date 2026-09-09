---
type: task
blocked_by: []
---
# What `materialiseTopic` actually collects, and the stale marker above it

## Question

Filed 2026-09-03 out of [20](20-ponytail-debt-ledger.md), the ponytail debt harvest,
which flagged this marker as one of three load-bearing ones and then found the marker
itself to be **factually stale**.

The `ponytail:` comment at `convex/routine.ts:933` (this ticket said `:838` until
2026-09-09, its own pointer having drifted) said the query "returns all Lesson
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

- The stale marker at `convex/routine.ts:933` is corrected in the tree so it describes
  what the query actually reads today, with an absolute date. This is true regardless of
  what is decided below.
- A measured call on the real reads: how big `learningRecords.markdown` and the
  `questions` / `responses` collects actually get on the largest live Topic, how often a
  materialise run happens, and therefore whether anything needs paginating at all. A
  resolution of "measured, and it is fine, here are the numbers" is a good outcome; a
  resolution with no numbers is not.

## What landed, 2026-09-09

From the `2026-09-09-convex-cost-and-course-caching` handoff, which routed here for
the one item on this ticket that was gated on nothing. **The marker half is done, the
measured half is untouched, and this ticket therefore stays open.**

The `ponytail:` marker above `collectTopicContext` is corrected in the tree. Two
things were stale in it rather than one:

- **The claim itself**, confirmed stale by reading the code, not inferred.
  `convex/schema.ts` gives the `lessons` table `htmlStorageId` and no `html` field,
  and `collectTopicContext` projects each lesson and reference to a signed `htmlUrl`
  plus the blob id, never the body bytes. No Lesson HTML crosses that query. The
  header sentence just above it, "Lessons + References (with HTML)", was stale in
  exactly the same way and is corrected in the same edit.
- **This ticket's own pointer.** The marker sits at line 933; the `:838` above was
  wrong when written or drifted since. Corrected in both places here.

The replacement marker names what the debt harvest actually found fat, so a reader
who stops at the comment now gets the right concern rather than the wrong one:
`learningRecords.markdown` collected in full for every record, plus unpaginated
`questions` and `responses` collects, once per materialise run rather than per page
view.

**What is left is the whole point of the ticket: the measured call.** Nothing here
measured anything, and a resolution without numbers is explicitly not a resolution
on this ticket. One piece of prior evidence worth not re-deriving, and worth not
over-reading either: the folded
[convex-cost baseline](../assets/convex-cost-baseline.md) already put
`routine.materialiseTopic`'s `learningRecords.markdown` collect at **1.24 MB/month**
and ruled it out of scope on that basis. That points at "it is fine", but it is a
monthly aggregate across all runs, not the per-run figure on the largest live Topic
that this ticket asks for, and it says nothing at all about the `questions` and
`responses` collects.
