# app-language-i18n/01: Global app-language picker (full chrome i18n)

**Status:** prior-art — folded into [00 — Chrome i18n map](00-app-language-i18n-map.md) (2026-07-19)
**Depends on:** the course-translation feature (Editions + content translation)
**Imported:** from GitHub #14 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> **Prior art, not a live ticket.** As of 2026-07-19 this is superseded by the wayfinder map
> [00 — Chrome i18n map](00-app-language-i18n-map.md), which folds its proposed solution shape in as
> prior art to grill *against* (adopt / revise / reject), not as settled decisions. Notably its
> **"RTL is app-wide"** decision is now **out of scope** — all five target languages (English,
> Afrikaans, Spanish, French, Hindi) are left-to-right. Read the map for the current frontier.

> Migrated from [`.scratch/app-language-i18n/issues/01-global-app-language-picker.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/app-language-i18n/issues/01-global-app-language-picker.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

This issue localises the app *chrome*; the course-translation feature localises the course
*content*. Vocabulary: an **Edition** = a `(Topic, language)` pair (the unit of
content access); **App language** = the reader's global UI-locale preference,
distinct from which Editions they can access.

The course-translation feature translates authored **content** (lessons,
references, mission/title, Q&A) into other languages, gated per **Edition**. But
the React **chrome** — nav, buttons ("Next lesson", "References", "Ask a
question"), progress labels, the dashboard, empty states — stays English. A
learner reading a Spanish edition still sees an English frame around it. To
"completely translate the course" the whole reader must be localisable.

### Decision (from the 2026-07-06 grilling session)

- **App language is a separate, global preference** — sticky across every page,
  independent of which Editions the reader can access. Content stays
  Edition-gated, so an accepted state is *Spanish chrome around an English
  lesson* (when English is the only Edition the reader holds).
- **RTL is app-wide.** When the app language is a right-to-left language (Urdu,
  Arabic, …) the whole layout flips (`dir="rtl"` on the document), not just the
  content iframe.

## Scope

1. **App-language preference storage.**
   - Signed-in users: a locale field (on `users`, or a small `userPrefs` row).
   - Guests: `localStorage` (chrome is *not* access-controlled — only content
     is — so a Guest may pick any UI language freely).
   - A language **picker** in the app header/dashboard sets it; the searchable
     ISO-639 list (code + English name + native name + RTL flag) is shared with
     the course-translation Edition picker.

2. **A `localizations` catalog, app-wide (NOT per course).**
   - The set of UI strings, translated **once per language** and cached in
     Convex (`localizations` table keyed by language, English is the source).
   - Generated via the **same Claude-Messages-API path** the content translator
     uses. Rule: the first time *any* language becomes needed (a course Edition
     is added in it, or a user selects it), ensure that language's chrome catalog
     exists — generate-if-missing, then reuse across all courses and users.

3. **A runtime i18n layer — not a build-time framework.**
   - Languages are added at *runtime* (owners pick any language) and their
     strings live in Convex, so build-time catalogs (next-intl/react-intl static
     JSON) do **not** fit. Use a **lightweight dictionary loaded per-locale from
     Convex** with an English fallback for any missing key.
   - Extract the reader/dashboard hard-coded strings into keys behind a `t(key)`
     lookup fed by the active locale's dictionary.

## Out of scope

- Content translation and Edition access — that is the course-translation
  feature this depends on.
- Selling Editions / monetisation — deferred separately.
- Translating Guest-authored content or the operator/admin surfaces beyond the
  learner reader + dashboard, unless trivially covered by the same catalog.

## Notes

- Original ticket status (superseded by the front-matter status above): open —
  chrome i18n not started; the existing pickers switch course/Edition content,
  not the UI locale.
- The reader chrome renders around a **sandboxed lesson iframe** (ADR 0011);
  the iframe already gets its own `dir`/`lang` from the content Edition, so the
  chrome `dir` and the iframe `dir` can differ (Spanish chrome, Urdu content) —
  verify both are set independently.
- Catalog generation for an arbitrary language is a one-off cost per language;
  cache aggressively and never regenerate an unchanged catalog (hash the source
  string set, mirroring `translations.sourceHash`).
- Consider a fallback banner or subtle marker when chrome is localised but the
  content Edition the reader holds is a different language, so the mixed-language
  state is not read as a bug.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no i18n framework in package.json, no locale/message catalogs, chrome strings hard-coded English (CourseShell.tsx:175-202). The existing pickers (`LanguageSwitcher`, `AddLanguagePanel`) switch Edition content only, not the UI locale.
