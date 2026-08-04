# Urdu chrome locale (the first RTL app language)

<!-- Charted 2026-08-04 from a one-line operator ask: "Urdu language in settings".
     This is the fresh effort that app-language-i18n's `## Out of scope` RTL bullet
     said would be needed if an RTL chrome language was ever wanted — that map is
     closed on the LTR-only premise and is NOT reopened here. This map is an INDEX,
     not a store: each decision lives in its own ticket. -->

## Destination

Urdu is offerable as an **app (chrome) language** in settings — `messages/ur.json` complete
and parity-green, `ur` in the offer set — and the chrome renders **right-to-left** without the
layout coming apart. The RTL question is the whole difficulty; the catalogue is the easy half.

## Notes

- **This map carries build tickets, not just decisions** (wayfinder's plan-don't-do default is
  overridden here, per the tracker contract). Only [01](tickets/01-chrome-rtl-strategy.md) is a
  decision ticket; 02 and 03 are execution.
- **Urdu already exists as a *content* language and is already RTL-aware there.**
  `convex/languages.ts:41` carries `{ code: "ur", name: "Urdu", native: "اردو", rtl: true }`,
  and the reader flips a lesson iframe with `setRootDirLang` / `buildSrcDoc`'s `dir` param
  (`src/app/_components/lessonSrcDoc.ts:359`), with `dir` on the option elements in
  `Editions.tsx`, `CourseShell.tsx` and `Dashboard.tsx`'s language chips. **Per-edition content
  RTL is not this effort's problem** — what is missing is RTL for the *app around it*.
- **What "in settings" means.** The app-language picker is
  [`LocalePicker.tsx`](../../../src/app/_components/LocalePicker.tsx), and its offer-set is
  `LOCALES` in [`src/i18n/config.ts:10`](../../../src/i18n/config.ts) — `["en","af","es","fr","hi"]`
  — i.e. the locales that have a `messages/<code>.json`, **not** the ~130-entry content menu in
  `convex/languages.ts` (that only supplies native names). Adding Urdu chrome = a new message
  file + a `LOCALES` entry; `langInfo("ur")` already returns the endonym. Note
  `src/i18n/config.test.ts:27` asserts the exact locale set, so it changes in the same commit.
- **`dir` is hardcoded today, deliberately.** `src/app/layout.tsx` sets `<html lang={locale}>`
  with the comment "`dir` stays ltr — RTL is out of scope". That line is the seam 03 changes,
  and the comment is the stale claim to fix when it does.
- **A Nastaʿlīq font is likely needed**, by the same escape hatch that gave Hindi
  `Noto_Serif_Devanagari` (`layout.tsx:38`, swapped on via `isDevanagari(locale)`). Urdu in a
  Latin-only face renders as tofu; Noto Naskh vs Noto Nastaliq is a real legibility choice, and
  Nastaʿlīq needs far more line-height. Ticket 01 owns it.
- **Ponytail posture.** One RTL locale, four known tenants. The cheapest thing that reads
  correctly beats a general bidi framework — but *cheap* here has to be measured against a
  whole-app sweep, which is exactly what 01 has to size honestly.
- Sibling map: [app-language-i18n](../app-language-i18n/map.md) owns the i18n architecture
  (next-intl without routing, cookie-resolved locale, repo `messages/*.json`, key-parity test).
  This map **consumes** those decisions and does not revisit them.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether Urdu chrome implies an Urdu *catalogue* offer.** The catalogue's card title +
  mission ride the app-language with an English fallback (app-language-i18n ticket 06), so an
  Urdu chrome user sees English cards until an Urdu Edition exists. Legitimate, but it may read
  as broken. Overlaps the mixed-language-marker fog on both sibling maps — whichever reaches it
  first owns it.
- **Who reviews the Urdu strings.** Machine-drafted then reviewed is the established pattern
  for af/es/fr/hi, but nobody has been named for Urdu, and a bad RTL translation is much harder
  to eyeball than a bad French one. Sharpens once 02 has a draft.

## Out of scope

- **The i18n layer, catalogue storage and key convention** — locked on
  [app-language-i18n](../app-language-i18n/map.md).
- **Per-edition content RTL** — already ships (see Notes).
- **Admin / authoring / studio surfaces** — English-working owner set; off-route there as here.
- **Any second RTL language** (Arabic, Hebrew, Farsi). If 01 is done well the next one is a
  message file; that is a reason to design for it, not to chart it.
