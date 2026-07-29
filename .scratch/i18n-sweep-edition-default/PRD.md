# PRD — Full-app i18n sweep + locale-aware course editions

> **Status: shipped.** Reconciled against `main` on 2026-07-29 — all nine issues
> (01–09) have landed. `useTranslations` is wired through `CourseSettings`,
> `Editions`, `ArtifactView`, `Certificate`, `Landing`, `Dashboard` and `ui.tsx`;
> `messages/{en,af,es,fr,hi}.json` each carry 395 keys with real (not placeholder)
> values across 14 namespaces; `Dashboard.openLang` and `CoursePanes` both take
> the UI locale via `useLocale()`. `AdminPanel` remains deliberately un-translated
> (out of scope). GitHub #70/#71/#72 track 07/08/09 and are closable.
>
> **One stale detail below:** this PRD says the App-language cookie is
> `hindi_locale`. It was **renamed to `hindi_lang`** (and `hindi_theme` →
> `hindi_mode`) at the per-tenant session cutover — [ADR 0025](../../docs/adr/0025-per-tenant-session-isolation.md).
> The rename is load-bearing, not cosmetic: the old parent-domain cookies are still
> in browsers with a year-long max-age and would shadow the new host-only ones under
> the same name.

## Problem

The app has a working chrome-i18n system (next-intl, 5 locales `en/af/es/fr/hi`,
`hindi_locale` cookie) but large learner-facing surfaces were never wired to it —
they stay English even when the UI locale is Hindi. The reporting user has their
UI set to Hindi and sees English in the **Course settings** and **Editions &
sharing** modals (and elsewhere). Separately, the UI locale is disconnected from
the **content edition** a course opens in: a Hindi user opening a course still
lands in English even when a Hindi edition exists.

## Two independent systems (do not conflate)

- **Chrome i18n** — next-intl. `useTranslations("<Namespace>")` → `t("key")`.
  Source dict `messages/en.json`; locale files `messages/{en,af,es,fr,hi}.json`.
  Parity test `messages/parity.test.ts` enforces identical key sets across all 5.
  Current UI locale readable client-side via next-intl `useLocale()`.
- **Content editions** — Convex `translations` table, ~130 langs, selected by
  `?lang=` URL + `hindi:lang` localStorage. Resolved server-side by
  `resolveReaderEdition` (honours only editions the caller holds).

The 5 chrome locale codes are all valid content-lang codes, so chrome→edition is
a 1:1 identity map (Hindi UI = `hi` edition).

## Goals

1. **Translate all learner-facing hardcoded English** to next-intl. In scope:
   `CourseSettings`, `Editions`, `ArtifactView`, `Certificate`, `Landing`,
   `Dashboard` gaps, shared `ui.tsx` (Close/Cancel). **Out of scope:** `AdminPanel`
   (admin-only) — deferred.
2. **Open-course defaults to the UI locale's edition** when one exists, unless the
   learner explicitly switched this course before (last-used wins). Falls back to
   English.
3. **Course settings (from dashboard) edits the UI-locale edition** when a matching
   edition exists — same behaviour the reader already has on a translated edition —
   else the English source.

## Non-goals

- Translating `AdminPanel`.
- Adding new content languages or changing the translation engine.
- Localizing the default-site brand name "My Course" — it stays a proper-noun
  fallback (whitelabel tenants already override it).
- Server-side per-user content-language preference (edition choice stays client-side).

## Decisions (from grilling)

- Sweep = whole app, minus AdminPanel.
- Open-course precedence: **URL lang → UI-locale edition (if held) → last-used
  (if held) → English.**
- Settings Details section follows a target edition: reader → edition being read;
  dashboard → UI-locale edition if the course has it; else English source.

## Translation values

New non-`en` values (`af/es/fr/hi`) are machine-generated and should get a human
review pass later. English is authoritative; parity test forces all 5 files to
carry every key, so none can be left blank.

## Issues

- `01` — CourseSettings modal → next-intl (+ self-resolving target edition).
- `02` — Editions & sharing modal → next-intl.
- `03` — ArtifactView (reader + QuestionBox + editor) → next-intl.
- `04` — Certificate + EmblemSection → next-intl (ICU plurals for lesson counts).
- `05` — Landing page → next-intl.
- `06` — Dashboard gaps (NewCourseCard, AdminCourseMenu, title attrs) + shared
  `ui.tsx` Close/Cancel → next-intl.
- `07` — Open-course defaults to UI-locale edition (Dashboard `openLang` +
  CoursePanes precedence).
- `08` — Course settings from dashboard edits the UI-locale edition (part 3).
- `09` — Fill `af/es/fr/hi` values for every new key; parity test green.
