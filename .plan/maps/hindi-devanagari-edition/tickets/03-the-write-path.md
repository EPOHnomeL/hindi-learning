---
type: grilling
blocked_by: []
---
# The write path: clone-then-mutate, blobs, which fields, and what `sourceHash` means

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/03-the-write-path.md`

## Question

`cloneEdition` ([convex/translate.ts:409](../../../convex/translate.ts#L409)) already stands up
an Edition from an existing one, but it copies content **verbatim** — it was built to relabel a
linguistically-close translation, not to transform one. Decide exactly how the converted rows
get written. Five things have to come out of this, and they interact:

1. **Clone-then-mutate, or write directly?** Cloning gets the `translationJobs` row and the
   `shares`/`pendingShares` copy for free, then a second pass rewrites each row's content. Writing
   directly means reimplementing that. Cloning also means the Edition briefly exists in prod
   holding *romanized* text under the `hi` label — is that acceptable, and does anything read it
   in that window? Note `cloneEdition` refuses if `hi` already has a job, so check whether one does.
2. **Blob-backed rows.** A `translations` row carries content in `html` **or** `htmlStorageId`
   (`_storage`), and the reader serves whichever is present. Cloned rows inherit the storage id —
   which now points at *the source Edition's* blob. Writing converted content must not corrupt the
   `hi-Latn` Edition. Decide: write inline `html` and clear `htmlStorageId`, or write a new blob.
3. **Which `kind`s and which fields.** The union is `lesson | reference | mission | title |
   question`, and the row carries `title`, `html`, `text`, `reply`. Enumerate what actually needs
   converting. `mission` in particular is translated-but-never-read per
   [course-translation/map.md](../../course-translation/map.md) — decide whether to spend on it.
4. **`sourceHash`.** It hashes the **English** source and drives freshness — `translate.ts` skips
   an item whose stored hash matches. Converted rows inherited it from `hi-Latn`. Decide what the
   `hi` rows should carry, given that a future English edit followed by a re-translate must not
   silently treat these rows as fresh, and given that a `hi` re-translate would overwrite the
   conversion entirely. Say what the intended re-translate behaviour for this Edition even is.
5. **Idempotency and abort.** The script hits prod. What happens on a half-finished run — resume,
   or tear down and restart? What's the teardown?
6. **Fan-out and context discipline — new.** 02 resolved the converter to be the **Claude Code
   harness itself**, not an API call (01 is superseded). Per lesson that is only ~7 K in /
   ~6 K out tokens, so the run fans out — one subagent per lesson, ~10 concurrent, ~10–20
   minutes for all 59 in a single session. The constraint is context, not time: ~900 K tokens
   of Devanagari cannot pass through the orchestrating session, so **subagents must write to
   disk and the parent must never read the converted documents back** — it orchestrates, runs
   `02-check-harness.ts` per item, and sees only pass/fail. Decide the disk layout that makes
   that work, whether publishing happens per item as it passes or in one batch at the end, and
   how a re-run skips what already passed (point 5's resume, which is now cheap rather than
   the normal case).

## Done when

Each of the six has a decision with its reasoning, concrete enough that the build session
writes the script without reopening any of them. Names the specific functions and tables touched,
and states what the script must **not** touch (`publicLinks`, `enrollments`, `entitlements`,
`listings` are already excluded by `cloneEdition` — confirm that's still right here). The
fan-out decision names the disk layout and states plainly what the orchestrating session is
forbidden to read.
