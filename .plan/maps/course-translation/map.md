# Course translation follow-ups

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

**Reached 2026-08-04. This map is closed.**

It was charted to close out three deferred follow-ups from the translation review. What it
actually delivered was different and larger: the **`st-ZA` (South African Sesotho) Edition,
live on prod and seen rendering** — cloned from the Lesotho `st` Edition and rewritten in
place, with no English→Sesotho translation run. Two of the three original follow-ups closed
unbuilt.

## Notes

- **Content translation ships** — the `translations` table, `convex/translate.ts`, the
  per-Edition reader switcher. Everything on this map was a follow-up on that, not a re-design.
- **`st-ZA` is LIVE on prod**: 59 rows published 2026-08-02, `st` verified byte-untouched,
  owner-published and opened in a browser 2026-08-04.
- **Its orthography rests on agent inference that no Sesotho speaker has checked.** The rules
  were derived from frequency, word shape and general Bantu orthography by an agent that does
  not read the language. The planned translator review (07) was resolved *reactively* — errors
  get corrected if a reader hits them. Safe only because the transform is **idempotent**:
  correcting is a rules edit plus a re-`--publish`, and re-publishing unchanged rows is a no-op.
- Skills, if any of this is reopened: `convex:convex-expert`, `/tdd`.

### Tooling and assets — reuse, don't rebuild

`scripts/st-za-rewrite.ts` (`--clone` / dry run / `--publish`, idempotent),
`scripts/_verify-st-za.ts` (structural), `scripts/_verify-prod-st.ts` (marker counts on prod).
Assets: [assets/06-orthography-rules.md](assets/06-orthography-rules.md) (rule reasoning),
[assets/06-ledger.tsv](assets/06-ledger.tsv) (1569-row review ledger),
[assets/06-rules-check.mjs](assets/06-rules-check.mjs) (19-case rule check).

### Two traps this map paid for, worth not re-paying

- **Never use the Convex CLI against prod here.** A dev `CONVEX_DEPLOY_KEY` in `.env.local`
  beats `--prod` and answers for dev while looking identical. Use
  `ConvexHttpClient(convexUrl(true))`, as every script in `scripts/` already does.
- **A verification script can lie.** Ours compared prod against a directory the dry run
  regenerates, and read text-only rows through `r.html` (always `undefined`), so it reported
  both a false alarm and a false pass in the same run. Prefer checks that need no local snapshot.

### Known gaps left open on purpose

Recorded here because they are live conditions, not unfinished tickets:

- **`cloneEdition` still lands a new Edition finished-but-invisible** — it creates no
  `publishedEditions` row and says nothing about it. That is exactly how `st-ZA` sat unreachable
  without anyone noticing. Undecided, not fixed ([08](tickets/08-a-cloned-edition-is-not-reachable.md)).
- **`publishTranslation`'s quiz-structure guard does not run for blob-backed sources.** Turned
  off by the lessons/references blob move and never replaced
  ([05](tickets/05-drop-inline-html-contract.md)).
- **A malformed `data-no` attribute is in the authored English** and inherited by every Edition;
  its learner-visible impact was never established
  ([09](tickets/09-unescaped-quote-breaks-quiz-feedback-markup.md)).

## Decisions so far

- **04 — Edition-removal race + translation cleanup nits**: race and error-clear shipped in
  `a255df8`; the "dead `by_topic_email_lang` index" premise was **false** — `cloneEdition` uses
  it — and `setTopicPublic`'s fate is closed undecided [ticket](tickets/04-edition-removal-race-and-cleanup-nits.md)
- **05 — Drop inline `html` (contract)**: lessons and references are blob-only; `translations.html`
  stays inline and the dual read shape is the accepted end state, at the cost of the quiz-structure
  guard [ticket](tickets/05-drop-inline-html-contract.md)
- **06 — Build the South African Sesotho Edition by cloning the Lesotho one**: `st-ZA` live on prod,
  59 rows derived from `st` with no English→Sesotho run, `st` untouched, rendered page seen
  2026-08-04 [ticket](tickets/06-sesotho-za-from-lesotho-clone.md)
- **07 — Get a Sesotho speaker's verdict on the st→st-ZA rewrite**: not running the ledger review —
  the translator raises problems if he meets them in the course, and corrections republish cheaply
  because the transform is idempotent [ticket](tickets/07-sesotho-translator-verdict-on-the-ledger.md)
- **08 — A cloned Edition is live data that no learner can reach**: owner published `st-ZA` and
  walked it in a browser; whether `cloneEdition` should copy `publishedEditions` or warn is closed
  undecided [ticket](tickets/08-a-cloned-edition-is-not-reachable.md)

## Not yet specified

<!-- empty: the map is closed. Anything below returns as a fresh effort, not a resumption. -->

## Out of scope

- The **catalogue card's** English mission — the ticket's premise ("translated but never read")
  was falsified before the effort ended; the mission *is* served in the reader, and the one
  remaining surface is a different question
  ([ticket](tickets/02-course-mission-translated-but-unread.md)).
- **RTL reader chrome and the re-translate affordance** — no RTL Edition ships today, so the
  chrome flip has no user; the retry affordance is small polish closed unbuilt
  ([ticket](tickets/03-rtl-chrome-and-retranslate-affordance.md)).
- **The unescaped `"` in quiz feedback** — an authoring defect in the English source that every
  Edition inherits, so translation is neither cause nor cure
  ([ticket](tickets/09-unescaped-quote-breaks-quiz-feedback-markup.md)).
- App-wide chrome localisation ([app-language-i18n](../app-language-i18n/map.md)).
- Who pays for translated Editions —
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).
