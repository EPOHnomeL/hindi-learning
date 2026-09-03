# Translation and locales: Editions, translators, and the app's own chrome

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Everything about **language** lives in one place: the people who translate, the
Editions they produce, whether those Editions are honestly described, and the app
chrome around them.

Chartered 2026-09-01 by gathering the language work scattered across three feature maps
(`translator-status-report`, `urdu-chrome-locale`,
`english-source-untranslated-chrome`), during the consolidation that took `.plan` from
33 map directories to 7 active maps.

Scope is fixed by one test: **does this change what language something is in, or who
put it there?** The translator roster, the third Share role, the revenue split, message
catalogues and untranslated-English defects all pass.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. Tickets
  [01](tickets/01-translators-table-and-roster-import.md),
  [02](tickets/02-translator-as-a-third-share-role.md),
  [03](tickets/03-editions-panel-translator-selector.md),
  [06](tickets/06-settle-the-northern-ndebele-code.md),
  [07](tickets/07-build-the-translator-revenue-share.md) and
  [08](tickets/08-urdu-message-catalogue.md) are execution.
  [04](tickets/04-does-finished-lie.md) and
  [05](tickets/05-the-translator-revenue-share.md) are decisions, and
  [09](tickets/09-count-across-editions.md) is research.
- **Verify before reasoning.** Checked in the tree on 2026-09-01: there is **no
  `translators` table** in `convex/schema.ts` (01 is real) and **no `messages/ur.json`**
  (`messages/` holds `af`, `en`, `es`, `fr`, `hi`), so 08 is real. Re-check before
  acting.
- **The RTL spine is not here, on purpose.** Urdu is the first RTL app language, but
  deciding the chrome RTL strategy and flipping the app shell are
  [technical-foundation/09](../technical-foundation/tickets/09-chrome-rtl-strategy.md)
  and [10](../technical-foundation/tickets/10-rtl-app-shell.md), moved there on
  2026-09-01 because they are physical-property debt across every surface rather than a
  language question. This map keeps only the message catalogue,
  [08](tickets/08-urdu-message-catalogue.md). It was charted to ship **left-aligned**
  until the shell caught up; in the event the operator chose the full flip and both
  landed on **2026-09-03**, so Urdu never shipped left-aligned at all.
- **The revenue share touches the money rail.** Prod has taken real purchases since
  2026-07-29. [05](tickets/05-the-translator-revenue-share.md) decides a third split and
  who may set it; [07](tickets/07-build-the-translator-revenue-share.md) builds it. Use
  `tdd`, do not test against prod, and note that ADR 0016 no longer describes the rail
  that shipped, which is
  [technical-foundation/14](../technical-foundation/tickets/14-adr-superseding-0016-payfast-merchant-model.md).
- **The weekly status report itself is finished.** The four report tickets on the donor
  map (`translator-status-report/04` through `07`) are closed out of scope, and the
  report is not part of this map's Destination. What survived is the roster, the role,
  the split and the honesty question.
- Skills worth calling here: `research` for 09, `grilling` for 04 and 05, `tdd` for 07
  and for 08 (which names `messages/parity.test.ts` and `src/i18n/config.test.ts` as its
  own gate), and `domain-modeling` if 02 needs a CONTEXT.md term for the third role.

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | The translators roster and the fourteen rows | `translator-status-report/01` |
| 02 | Translator as a third Share role | `translator-status-report/02` |
| 03 | Appoint a translator from the Editions panel | `translator-status-report/03` |
| 04 | Does "Finished" lie about the five machine Editions | `translator-status-report/08` |
| 05 | The translator revenue share | `translator-status-report/09` |
| 06 | Settle what language Bishop Ndumisa translates | `translator-status-report/10` |
| 07 | Build the translator revenue share | `translator-status-report/11` |
| 08 | Add `messages/ur.json` and offer `ur` in the picker | `urdu-chrome-locale/02` |
| 09 | Is the untranslated English one defect or three | `english-source-untranslated-chrome/01` |

Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
donor maps. The old numbers remain those tickets' identity in their donor maps'
history, so **do not reuse them here**. Each moved ticket carries an HTML comment
footer naming where it came from.

The four language efforts that are **already finished** are the context for all of the
above, and they stay where they are: [app-language-i18n](../app-language-i18n/map.md)
(the Chrome i18n rail), [course-translation](../course-translation/map.md),
[hindi-devanagari-edition](../hindi-devanagari-edition/map.md) and
[i18n-sweep-edition-default](../i18n-sweep-edition-default/map.md). Read them before
grilling 04, which is a question about exactly what those efforts produced.

## The dependency graph

Three edges.

```
01 translators roster   ->  03 appoint from the Editions panel
02 third Share role     ->  03 appoint from the Editions panel
05 the revenue share    ->  07 build the revenue share

frontier (7):  01 02 04 05 06 08 09
blocked   (2):  03 07
```

- **01 and 02 to 03**: the selector is a surface over a roster and a role. Neither
  exists yet, and building the panel first would mean building it against a shape that
  01 and 02 are still free to change.
- **05 to 07**: a third split on a live money rail is a decision before it is code. 07
  is deliberately a separate ticket so the decision can resolve while the build renders
  unstarted, which is the only way this tracker can show "decided, not built".

## Decisions so far

<!-- one line per resolved ticket -->

<!-- The four closed report tickets on the donor map are out of scope, not resolved,
     and are not this map's decisions. -->

- [Urdu message catalogue](tickets/08-urdu-message-catalogue.md) 2026-09-03: `messages/ur.json`
  ships all 709 keys and `ur` joins `LOCALES`, making Urdu the sixth app-chrome language.
  The picker and the `Accept-Language` sniff both needed no change, since each reads
  `LOCALES`. ICU arguments and plural categories were checked with the real ICU parser,
  not a regex, because plural branch text is braced too. Strings are LLM-drafted and
  pending human review, as every non-English catalogue has been since `b2a4887`.

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. -->

- **Whether the untranslated English is worth fixing, and where.** Ticket
  [09](tickets/09-count-across-editions.md) deliberately stops at the numbers and says
  so: it counts how much untranslated English each Edition carries and names the fix
  site for each class, and it does **not** decide whether to fix any of it. The fix is a
  ticket that cannot be phrased until the counts exist.
  `clears-with: 09`
- **What "Finished" should say instead**, if [04](tickets/04-does-finished-lie.md) finds
  that it lies about the five machine Editions. The replacement wording, and whether the
  distinction is per Edition or per language, both depend on what that grilling
  concludes.
  `clears-with: 04`
- **Which language is next after Urdu, and on what evidence.** Every new Edition
  multiplies the per (Topic, language) read that
  [technical-foundation/01](../technical-foundation/tickets/01-slim-the-row-listlessons-collects.md)
  is about, so this is a cost question as much as a reach question. Floating with no
  anchor: no ticket here sharpens it, and the answer is a business one.

## Out of scope

- **The chrome RTL strategy and the app-shell flip**: `technical-foundation/09` and
  `/10` (see Notes).
- **The weekly translator status report** and its Routine: closed out of scope on the
  donor map.
- **Read amplification from having many Editions**: `technical-foundation/01`.
- **How a translated Edition is priced or sold**: `distribution`. What a translator may
  *edit* is `authoring`, including
  [authoring/08](../authoring/tickets/08-editor-details-door.md), the Details door for a
  translated Edition's Editor.
- **Superseding ADR 0016**: `technical-foundation/14`.
- **The i18n layer, catalogue storage and the key convention.** Locked on
  [app-language-i18n](../app-language-i18n/map.md). Carried over from
  `urdu-chrome-locale`.
- **Per-Edition content RTL**, which already ships. It is the app *chrome* that is not
  RTL yet, and that is `technical-foundation/09` and `/10`.
- **The admin, authoring and studio surfaces in any non-English locale.** An
  English-working owner set is the decided position; off-route there as here.
- **Any second RTL language** (Arabic, Hebrew, Farsi). If the RTL strategy is done well
  the next one is a message file, which is a reason to design for it, not to chart it.
- **The Devanagari Edition's own repair**, which is decided and owned by
  [hindi-devanagari-edition/06](../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md).
  Ticket [09](tickets/09-count-across-editions.md) counts it; it does not fix it.
