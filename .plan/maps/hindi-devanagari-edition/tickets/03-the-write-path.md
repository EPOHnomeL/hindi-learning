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

## Answer

**Resolved by executing it on 2026-08-04**, not by deciding it on paper — the user chose to
publish in-session rather than hand a spec on. So every answer below is evidenced by a real prod
run, and the script that did it is preserved at
[assets/03-publish.ts](../assets/03-publish.ts) (the working copy under `topics/_devanagari/` is
gitignored). Result: **59/59 rows saved, 0 skipped, Edition reported `ready`.**

1. **Clone-then-mutate — forced, not chosen.** `publishTranslation` returns `skipped` without a
   `translationJobs` row ([translate.ts:612](../../../convex/translate.ts#L612)), and
   `cloneEdition` is the only admin seam that creates one. So the clone is mandatory, and with it
   the window where `hi` holds romanized text. The window was **accepted** rather than mitigated:
   the alternative was deleting and recreating real viewer access rows, which leaves access
   missing if the run dies. Measured: `cloneEdition` copied **59 rows, 2 shares, 0 pendingShares**,
   so two real viewers could have seen romanized Hindi under a हिन्दी label during the run.
2. **Blob-backed rows — the fear was unfounded, and the mechanism is now known.**
   `publishTranslation` builds a fresh row object with no `htmlStorageId` and `db.replace`s the
   existing one, so the pointer is dropped and inline `html` is written. It never writes to
   `_storage`, and neither does `removeEdition`. Verified after the run: `blobBacked=0` on all 59
   rows, `hi-Latn` untouched. **`hi-Latn`'s blobs were never reachable from this path at all.**
3. **Which kinds and fields — and the gap the conversion left.** All five kinds present:
   `title`(1), `mission`(1), `lesson`(56), `reference`(1). `mission` **was** published despite
   being translated-but-never-read, because it was already converted and skipping it would have
   left the row romanized for no saving. The trap: `db.replace` means **every field must be
   re-sent or it is dropped**, and each of the 57 html rows carries a separate plain-text `title`
   that the conversion never touched — the "59/59 items converted" claim counted rows, not fields.
   Publishing `html` alone would have **wiped all 57 lesson titles**. The 57 titles were converted
   in-session (they are short) and are at `converted/row-titles.json`; verified `romanizedTitles=0`.
4. **`sourceHash` — settled by the existing code, not by us.** `publishTranslation` re-stamps it
   from the *current* English source ([line 635](../../../convex/translate.ts#L635)), so the `hi`
   rows read as fresh. Intended re-translate behaviour: **a `hi` re-translate must never run** — it
   would overwrite the conversion with a from-English translation. Freshness now prevents exactly
   that, which is the behaviour we want, arrived at for free.
5. **Idempotency and abort.** Re-running is safe and was exercised twice for real: the clone is
   skipped when `hi` already has rows, and `publishTranslation` compares every field and returns
   `unchanged`. Teardown is `removeEdition` ([translate.ts:363](../../../convex/translate.ts#L363)),
   which deletes rows, job, `publicLinks`, and the copied `shares`/`pendingShares` — but it takes
   **owner auth (`getAuthUserId`), not the admin secret**, so rollback happens in the app as the
   signed-in owner and *cannot* be done from this script. That asymmetry is worth knowing before
   relying on it.
6. **Fan-out and context discipline — moot in the end.** The conversion had already run in a prior
   session, so this session orchestrated no per-lesson subagents at all. The disk layout that
   mattered was `restored/`, not `converted/`: `converted/` still holds `⟦N⟧` placeholders where
   the static blocks were, and publishing it would have shipped lessons with their head chrome and
   scripts missing. The script asserts no `⟦` survives before sending anything. Publishing is one
   batch at the end, per item, with `skipped` treated as fatal — `reportTranslation('ready')` is
   withheld if any item skips, since a skipped item silently falls back to **English** in the
   reader.

**Two operational facts that cost a round-trip each, recorded so they cost nobody else one:**

- **`publishTranslation` needs the Topic's *owner* email, and it is not the obvious one.**
  `prophetic-school` is owned by `ywampotchtpm@gmail.com`; neither the operator's own address nor
  `OWNER_EMAIL` from `.env.local` (a different Topic's owner) works. `cloneEdition` resolves by
  slug alone and so succeeds regardless — meaning a wrong owner lets you create the Edition and
  then fail to fill it, which is the worst ordering.
- **Convex redacts thrown `Error` messages in production.** A wrong owner surfaces only as
  `Server Error`. The real message (`topic not found`) is in `npx convex logs --prod` — and
  `CONVEX_DEPLOY_KEY` must be blanked for that command or the CLI silently reads the **dev**
  deployment and shows nothing.

Confirmed untouched, as `cloneEdition` documents: `publicLinks`, `enrollments`, `entitlements`,
`listings`.
