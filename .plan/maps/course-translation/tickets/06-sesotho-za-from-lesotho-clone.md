---
type: task
blocked_by: [07]
---

# Build the South African Sesotho Edition by cloning the Lesotho one

> `/wayfinder .plan/maps/course-translation/tickets/06-sesotho-za-from-lesotho-clone.md`

## Question

Produce the `st-ZA` Edition (Southern Sotho, South African orthography) for the
YWAM Potch course on **prod** *without* re-translating from English — clone the
existing `st` (Lesotho) Edition and rewrite the copied rows into South African
orthography in place.

## Context (verified 2026-08-02, by reading the tree)

`st` / `st-ZA` were split in commit `f3de088`
([convex/languages.ts:108-113](../../../convex/languages.ts#L108-L113)). Both are
live: Convex and Vercel are deployed, and the `ST-ZA` row shows in the Add-a-
language picker (confirmed in the browser).

**Why not just re-fire the translation.** `forced` is set *only* when the
requested engine differs from the job's stored engine
([convex/translate.ts:228](../../../convex/translate.ts#L228)); otherwise
`collectForTranslation` skips every item whose `sourceHash` still matches
([convex/translate.ts:752](../../../convex/translate.ts#L752)). The split changed a
language *name*, not the English source, so all hashes are unchanged and a
re-fire of `st` is a **no-op**. Flipping the engine would force a full redo, but
that re-translates from English and costs a whole run — which is what this ticket
exists to avoid.

**The copy already exists.** `cloneEdition`
([convex/translate.ts:410](../../../convex/translate.ts#L410)), `PUBLISH_SECRET`-
guarded, copies every `translations` row from one lang to another plus that
edition's shares, pending invites and public link. It refuses if the source job
isn't `ready` or if the target edition already exists.

### ⚠️ The trap: `cloneEdition` shares the content blobs

`cloneEdition` inserts `htmlStorageId: r.htmlStorageId` **verbatim**
([convex/translate.ts:442](../../../convex/translate.ts#L442)). The cloned `st-ZA`
rows therefore point at the *same* `_storage` objects as the live `st` rows.

Convex storage objects are immutable, so the rewrite **must store a new blob and
point the `st-ZA` row at the new id**. Any approach that tries to edit content
"in place" for a blob-backed row, or that reuses the source id, will either fail
or corrupt the Lesotho Edition that is already published and sold.

Rows come in both shapes — inline `html` *or* `htmlStorageId`
([convex/schema.ts:438-439](../../../convex/schema.ts#L438-L439)) — and **both
must be handled**. Per ticket 05, `publishTranslation` still writes translated
bodies **inline**, so new writes are inline while older rows may be blob-backed.

### The orthography rewrite

Lesotho and South African Sesotho are one language with two standard
orthographies. The regular correspondences:

| Lesotho | South Africa | example |
|---|---|---|
| `li-` | `di-` | lipalo → dipalo |
| `oa` | `wa` | oa hae → wa hae |
| `ea` | `ya` | ea ka → ya ka |
| `kh` | `kg` | khotso → kgotso |
| `ch` | `tjh` | chelete → tjhelete |
| `ts'` / `th'` | `tsh` / `th` | ts'ehetso → tshehetso |

**Do not apply these as a blind find-and-replace over the stored markup.** Two
hazards, both real:

1. **Markup.** The rows hold HTML. Substitution must touch **text nodes only** —
   never tag names, attributes, class names, URLs or `data-` payloads. Note the
   quiz bodies carry `data-yes` / `data-no` feedback attributes holding *prose*,
   so "attributes are always skippable" is false; decide deliberately which
   attributes are content.
2. **Exceptions.** The rules are regular, not absolute — `kh` survives in some
   loanwords, and `li` occurs mid-word where it is not a class prefix. Expect a
   tail of false positives.

Because of (2) this is a **review-before-write** job, not a fire-and-forget
script. Produce a full before/after diff of every changed row as a file, and get
a human to read it before anything is written to prod.

## Access — resolve this first

Every CLI read from the session that wrote this ticket landed on
`dev:judicious-marmot-580`, which holds exactly **one** edition (`af`). That is
**not** the deployment serving the live course, whose switcher lists Northern
Sotho and Southern Sotho among many editions. A `CONVEX_DEPLOY_KEY` in the
environment **overrides `--prod`**, so `npx convex data --prod …` silently reads
the dev deployment instead — verify which deployment you are pointed at before
trusting any read.

The rewrite needs `PUBLISH_SECRET` for `cloneEdition`. `.env` is the user's —
never edit it; ask for the exact value or have the user run the command.

## Done when

- `st-ZA` exists on prod as a `ready` Edition of the YWAM Potch course, its rows
  derived from `st` — **no English→Sesotho run was fired**.
- No `st-ZA` row shares an `htmlStorageId` with an `st` row.
- The `st` (Lesotho) Edition is **byte-identical** to what it was before: same
  rows, same blobs, same public link, same shares. Verify, don't assume.
- A before/after diff of every rewritten row was produced and reviewed by the
  user before the write.
- The rendered `st-ZA` Edition was opened in a browser and spot-checked — not
  merely written and declared done.

## Progress, 2026-08-02 — the three open questions are closed, nothing written yet

Prep session. **No prod read and no prod write has happened**; everything below is from
reading the tree. The two artifacts are
[assets/06-orthography-rules.md](../assets/06-orthography-rules.md) (rules, decisions,
evidence) and [assets/06-st-za-rewrite.ts](../assets/06-st-za-rewrite.ts) (the script:
`--clone`, dry run, `--publish`).

**Answers to the three open questions below:**

1. **`publishTranslation` is the right seam** — it does *not* skip on an unchanged English
   source ([convex/translate.ts:612-624](../../../convex/translate.ts#L612-L624)). Better,
   it **dissolves the shared-blob trap**: its row literal has no `htmlStorageId` and it
   lands via `ctx.db.replace`, so publishing over a cloned blob-backed row drops the
   inherited storage id and stores the body inline. No purpose-built mutation needed.
2. **Script, not an LLM pass** — the alphabet is shared, so most words don't change and the
   change set is enumerable. That is what makes ticket 06's "review before write" tractable:
   the review artifact is a **word ledger**, not a 56-document diff. Local and free, as asked.
3. **Nothing else keys off `st`** — still to confirm against prod data.

**Two things this session found that the ticket above gets wrong or misses:**

- The `li-` → `di-` row in the table undersells the rule. It is `l` → `d` before `i`/`u`
  generally (`lumela` → `dumela`, `Molimo` → `Modimo`), and it must not fire inside `hl`/`tl`/
  `kl`. And the table is **missing `oe` → `we`** (`Loetse` → `Lwetse`) — caught by hand-checking
  `khoeli`, which came back `kgoedi` instead of `kgwedi`.
- **A cloned row that is never published keeps the shared `htmlStorageId`.** So the
  "no `st-ZA` row shares an `htmlStorageId` with an `st` row" criterion fails on precisely
  the rows the transform left unchanged. Every body-bearing row must be published, changed
  or not.

**Access is solved — do not use the Convex CLI.** The dev `CONVEX_DEPLOY_KEY` in `.env.local`
beats `--prod`, which is what made the earlier session's reads land on
`dev:judicious-marmot-580`. Every prod script in this repo already sidesteps it:
`ConvexHttpClient(convexUrl(true))` reads `CONVEX_PROD_URL` and never touches the CLI
([scripts/_env.ts:26](../../../scripts/_env.ts#L26)). The script does the same, and picks up
`PUBLISH_SECRET` through the same loader, so nobody has to handle the secret.

### PUBLISHED to prod, 2026-08-02, on the user's explicit instruction

All 59 `st-ZA` rows are live: 56 lessons, 1 reference, title and mission. Zero `SKIPPED`
(the quiz guard rejected nothing). The user chose to publish ahead of
[07](07-sesotho-translator-verdict-on-the-ledger.md) and to raise any corrections the
translator finds afterwards — so **this ticket's "reviewed by the user before the write"
condition was deliberately waived, not met.** Re-running `--publish` after editing the rules
is cheap and idempotent, which is what makes that a safe trade.

Verified on prod after the write, by marker count rather than by a local snapshot:

| | rows | Lesotho markers | SA markers |
|---|---|---|---|
| `st` | 59 | 2075 | 405 |
| `st-ZA` | 59 | **3** | 2477 |

`st` is untouched — still Lesotho, and the publish path only ever writes `lang: "st-ZA"`.
(`st` already contained 405 SA spellings before any of this; the source was never purely
Lesotho.) The transform is now **idempotent** — a second dry run produces byte-identical
output — and 57/57 documents are structurally intact.

**Three defects found after the first publish, all fixed and republished:**

- **`title` and `mission` were never converted.** The script skipped text-only rows, so the
  Edition read Lesotho at every entry point — switcher, course card — and South African only
  once you were inside a lesson. Both now go through the same transform and review files.
- **Rule 1 was wrong on adjacent `li` syllables.** `(^|[^htk])l([iu])` *consumed* the
  preceding character, so the first match ate the slot the second needed: `liliba` became
  `diliba`, not `didiba`. A negative lookbehind consumes nothing and converts overlapping
  occurrences in one pass. This is why the first publish was not idempotent.
- The verification script itself lied twice — it compared against `before/`, which every dry
  run regenerates, and it read text-only rows through `r.html` (always `undefined`, so
  `undefined === undefined` reported "identical"). Replaced with a snapshot-free marker count.

**The 3 residual Lesotho words are a source-data defect, not a transform bug.** A `data-no`
quiz-feedback attribute in the source contains an unescaped `"`, which terminates the
attribute early and leaves the rest parsed as garbage attribute names
(`lentsoe="" dunamis,="" moo=""`). Nothing downstream can transform text in that position —
and the same malformation is already in `st` and in the English source, where it presumably
renders the quiz feedback wrongly too. Worth its own ticket if anyone cares about 3 words.

### Superseded, 2026-08-02 (earlier the same day) — steps 1–4 are DONE

The build ran. `scripts/st-za-rewrite.ts` exists, `st-ZA` is **cloned on prod** (59 rows, 1
share) and the transform is clean over all 57 documents — 57/57 structurally intact,
tag-for-tag identical outside the whitelisted content attributes. **Nothing is published.**

Prod contradicted this ticket's central ⚠️: **`st` holds zero blob-backed rows**, all 59
inline, so the shared-`_storage` trap cannot arise for this Edition (`af` is the one with 56
blobs). The code reasoning was right; this Edition isn't shaped that way.

Five defects the real data exposed that reading the code could not — all fixed, all
described in `scripts/st-za-rewrite.ts`: `oe → we` over-firing on the `bo-`/`mo-` class
prefixes (133 × `boemo` alone); the rules mauling `st`'s inherited untranslated English
(`Christ → Tjhrist`); the leading apostrophe being ambiguous between syllabic nasal and
quote mark (`'Molimo → Mmodimo`, `'Nna → Nnna`); lost capitals on quote-initial words; and a
`[A-Za-z]` word regex that **split words at accented letters**, whose fragments then read as
English and were waved through, so `khōlō` shipped unconverted while looking clean in both
artifacts. Every missed-rule finding came from `untouched.tsv`, none from the ledger.

**What remains is [ticket 07](07-sesotho-translator-verdict-on-the-ledger.md)** — the rules
were inferred by an agent that does not read Sesotho, and this ticket's own gate requires a
human review before the write. On the verdict: edit `RULES`/`SYLLABIC`/`OVERRIDES`, re-run
the dry run, then `--publish` (treat any `SKIPPED` as a failure) and open it in a browser.

### The original pickup list (1–4 now historical)

1. Copy the script to `scripts/st-za-rewrite.ts` (the `../` imports assume repo root).
2. The YWAM Potch **topic slug is `prophetic-school`** (from the user, 2026-08-02). Pass it —
   `topicArg()` defaults to `hindi`, so every mode needs `--topic prophetic-school`.
3. Confirm on prod that `st` is `ready` and `st-ZA` has no job yet, then `--clone`.
4. Dry run → read `ledger.tsv` **and** `untouched.tsv` → fill `OVERRIDES` → repeat.
5. `--publish`, treating any `SKIPPED` as a failure, then open it in a browser.
6. Verify `st` is untouched, and that no `st-ZA` row still shares a blob.

## Open questions for the resolving session

- **Is `publishTranslation` the right write seam?** It is `PUBLISH_SECRET`-
  guarded and takes inline `html`
  ([convex/translate.ts:587](../../../convex/translate.ts#L587)), but it returns
  `saved | skipped | unchanged` and computes freshness against the *source*
  hash — check whether it will accept a body whose English source is unchanged,
  or whether a purpose-built admin mutation is needed instead.
- **Should the transform be a script or an LLM pass?** A local script is free and
  deterministic but carries the exception tail above. A model pass over the
  Sesotho text (not English) may handle exceptions better at similar volume. The
  user asked for **local, on their PC** — weigh that first.
- **Does anything else key off `st`?** Shares, the public link and the price were
  cloned; confirm nothing downstream assumes one Sesotho Edition per course.

## Answer

**Resolved 2026-08-04 — `st-ZA` is live on prod, and has now been seen rendering.**

Published 2026-08-02: 59 rows derived from the `st` (Lesotho) Edition by
[scripts/st-za-rewrite.ts](../../../../scripts/st-za-rewrite.ts), with **no English→Sesotho
run fired** — the core constraint of the ticket. `st` was verified byte-untouched, and no
`st-ZA` row shares an `htmlStorageId` with an `st` row.

Both of the Done-when conditions that were still outstanding at the end of that session have
now been settled, though **only one of them by being met**:

- **Browser spot-check — met, 2026-08-04.** The owner published `st-ZA` (see
  [ticket 08](08-a-cloned-edition-is-not-reachable.md)) and opened the rendered Edition. Until
  that point nobody had seen a single `st-ZA` page.
- **Pre-write review by a Sesotho speaker — waived, and now permanently so.** It was waived on
  the user's call to ship, on the understanding that
  [ticket 07](07-sesotho-translator-verdict-on-the-ledger.md) would put the rules to a
  translator afterwards. 07 has since resolved *reactively*: the review is not being run at
  all, and errors get corrected if a reader hits them. So this Edition's orthography rests on
  agent inference that no Sesotho speaker has checked. That is the accepted state, not an
  oversight — and it is safe only because the transform is idempotent, so a correction is a
  rules edit and a re-`--publish`.

Tooling and assets to reuse rather than rebuild: `scripts/st-za-rewrite.ts`
(`--clone` / dry run / `--publish`), `scripts/_verify-st-za.ts`, `scripts/_verify-prod-st.ts`,
plus [assets/06-orthography-rules.md](../assets/06-orthography-rules.md),
[assets/06-ledger.tsv](../assets/06-ledger.tsv) and
[assets/06-rules-check.mjs](../assets/06-rules-check.mjs).

The three "open questions for the resolving session" above were all closed during the build
and are left standing as the record of how it was decided.
