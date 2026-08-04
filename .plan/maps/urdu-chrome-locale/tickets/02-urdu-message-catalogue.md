---
type: task
blocked_by: []
---

# Add `messages/ur.json` and offer `ur` in the picker

## Question

The catalogue half, independent of RTL — a message file is just data, and it can land and be
parity-green before the layout flips (it simply reads wrongly-aligned until
[03](03-rtl-app-shell.md)).

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
