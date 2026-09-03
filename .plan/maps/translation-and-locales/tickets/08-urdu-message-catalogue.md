---
type: task
blocked_by: []
---

# Add `messages/ur.json` and offer `ur` in the picker

## Question

The catalogue half, independent of RTL — a message file is just data, and it can land and be
parity-green before the layout flips (it simply reads wrongly-aligned until
[03](../../technical-foundation/tickets/10-rtl-app-shell.md)).

- Add `messages/ur.json` with **exactly** `en.json`'s leaf keys — `messages/parity.test.ts`
  fails on any missing or extra key, which is the whole point of it. Preserve ICU plural syntax
  and `<tag>` rich placeholders per language; Urdu plural rules are not English's, so `one`/
  `other` cannot be copied mechanically.
- Add `"ur"` to `LOCALES` in `src/i18n/config.ts:10`. `src/i18n/config.test.ts:27` asserts the
  exact set (`["af","en","es","fr","hi"]`) — update it in the same commit or the suite goes red.
- Nothing else should be needed for the picker: `LocalePicker.tsx` maps over `LOCALES` and
  already renders each option with `dir={info.rtl ? "rtl" : "ltr"}`, and `langInfo("ur")`
  returns `اردو` (`convex/languages.ts:41`). Verify that claim rather than assume it — if the
  picker needs a change, that is a finding worth recording here.
- Check the `Accept-Language` sniff (`src/i18n/acceptLanguage.ts`) now maps an `ur` browser to
  Urdu rather than falling through to English, since it reads the offer-set.

Strings may be machine-drafted (the established pattern for af/es/fr/hi) — human review is a
separate concern, tracked as fog on [the map](../map.md).

## Done when

`pnpm test` is green — including `messages/parity.test.ts` and `src/i18n/config.test.ts` — with
`messages/ur.json` carrying exactly `en.json`'s leaf keys, and picking اردو in the app-language
picker renders the chrome in Urdu (still left-aligned until 03).

<!-- Moved 2026-09-01 from urdu-chrome-locale/02 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history. Its RTL spine stayed on technical-foundation (09 strategy, 10 app shell), where it was moved on the same day. -->

## Answer

Built 2026-09-03 in `c9e90a3`.

`messages/ur.json` carries exactly `en.json`'s 709 leaf keys, so
`messages/parity.test.ts` is green, and `"ur"` is in `LOCALES`
(`src/i18n/config.ts`). `src/i18n/config.test.ts` was updated in the same commit
as this ticket warned, both the assertion and its comment.

**The picker claim in the Question holds, verified rather than assumed.**
`LocalePicker.tsx` maps over `LOCALES`, calls `langInfo(code)` and already emits
`dir={info.rtl ? "rtl" : "ltr"}` per option; `langInfo("ur")` returns `اردو`
(`convex/languages.ts:41`). No picker change was needed, and none was made.

**The `Accept-Language` sniff needed no change either**, because it reads the
same array. Pinned anyway in `src/i18n/acceptLanguage.test.ts`: `ur` and
`ur-PK,ur;q=0.9,en;q=0.8` both resolve to `ur`. It is worth a test rather than a
shrug, since this is the first RTL locale and the entire chrome flip hangs off
that one mapping.

### On preserving ICU, which is where this could have gone quietly wrong

Urdu plural categories are `one`/`other`, the same pair as English, so the
branches map across without restructuring. But *checking* that they survived is
harder than it looks: a regex cannot tell an ICU argument from a plural branch,
because branch bodies are braced too. `{count, plural, one {lesson} other
{lessons}}` offers up `count`, `lesson` and `lessons` to any `\{(\w+)` pattern,
and the last two are prose that a translation is supposed to change.

So the check was done with the real parser (`@formatjs/icu-messageformat-parser`,
already in the tree under next-intl): parse both messages, walk the ASTs, and
compare the set of argument names and plural categories while ignoring branch
text. All 709 messages match, and the same check passes for `af`/`es`/`fr`/`hi`,
which is what proves it is not vacuous.

### Two things done beyond the Question

- **The four `→` glyphs baked into English messages carry `←` in Urdu**
  (`Artifact.nextLesson`, `Artifact.generateNext`, `Certificate.openPublicPage`,
  `Certificate.viewArrow`). A directional glyph inside a message is part of the
  message, so each locale writes its own; this is why no CSS mirrors them. Note
  the Question's sibling ticket 09 first attributed two of these to `Reader` and
  `Editions`; the namespaces above are the correct ones, read from the file.
- **`Landing.capabilities.t3v` went from `5` to `6` in all six catalogues.** The
  landing page advertises "languages the app itself speaks", which this ticket
  falsifies. Left alone it would have been a stale claim shipped by the very
  commit that made it stale.

Strings are LLM-drafted and pending human review, the established posture for
every non-English catalogue since `b2a4887`. That is unchanged fog on the map,
not a gap this ticket opened.
