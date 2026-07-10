# Global app-language picker (full chrome i18n)

Status: open — chrome i18n not started; the existing pickers switch course/Edition content, not the UI locale

> Blocked-by: the **course-translation** feature (Editions + content translation).
> This issue localises the app *chrome*; that feature localises the course
> *content*. Vocabulary: an **Edition** = a `(Topic, language)` pair (the unit of
> content access); **App language** = the reader's global UI-locale preference,
> distinct from which Editions they can access.

## Problem

The course-translation feature translates authored **content** (lessons,
references, mission/title, Q&A) into other languages, gated per **Edition**. But
the React **chrome** — nav, buttons ("Next lesson", "References", "Ask a
question"), progress labels, the dashboard, empty states — stays English. A
learner reading a Spanish edition still sees an English frame around it. To
"completely translate the course" the whole reader must be localisable.

## Decision (from the 2026-07-06 grilling session)

- **App language is a separate, global preference** — sticky across every page,
  independent of which Editions the reader can access. Content stays
  Edition-gated, so an accepted state is *Spanish chrome around an English
  lesson* (when English is the only Edition the reader holds).
- **RTL is app-wide.** When the app language is a right-to-left language (Urdu,
  Arabic, …) the whole layout flips (`dir="rtl"` on the document), not just the
  content iframe.

## Solution shape

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

## Out of scope (for this issue)

- Content translation and Edition access — that is the course-translation
  feature this depends on.
- Selling Editions / monetisation — deferred separately.
- Translating Guest-authored content or the operator/admin surfaces beyond the
  learner reader + dashboard, unless trivially covered by the same catalog.

## Notes / risks

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

- 2026-07-10 — Migrated to GitHub issue [#14](https://github.com/EPOHnomeL/hindi-learning/issues/14); GitHub is now the tracking home for this ticket.
