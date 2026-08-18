---
type: task
blocked_by: []
---

# Open-course defaults to the UI-locale edition

## Question

Precedence: URL `?lang` → UI-locale edition (if the course has it) → last-used
`hindi:lang` (if held) → English.

- `src/app/_components/Dashboard.tsx` `openLang` (L449, L593): currently English-
  first. Change to: if a non-`en` UI locale (`useLocale()`) is among `course.editions`,
  use it; else keep English-first fallback. (This sets the card's Open-course href.)
- `src/app/_components/CoursePanes.tsx` (L35-51): the no-URL-lang redirect currently
  goes last-used → English. Insert UI-locale-edition ahead of last-used, matching the
  precedence above. Use `useLocale()`; only apply when `header.editions` contains it.

Note: chrome locale codes are valid edition codes (identity map). English UI keeps
English default. Do not persist to `hindi:lang` (that stays an explicit-switch memory).

Done when: a Hindi-UI user opening a course with a `hi` edition lands in `hi`;
without a `hi` edition, lands in English; an explicit prior switch still wins.

## Done when

A Hindi-UI user opening a course with a `hi` edition lands in `hi`; without a `hi` edition they land in English; an explicit prior switch still wins.

<!-- Migrated 2026-07-30 from GitHub issue #70 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

## Answer

**Already built when this ticket was migrated — resolved 2026-08-18 by reading the tree.**
Verified by evidence, not by walking a browser.

`cd1ddeb` (2026-07-21, *feat(editions): open courses and course settings in the UI
language*) shipped both halves of the precedence rule, nine days before the GitHub
backlog was migrated into this map. The rule reads exactly as specced — URL `?lang` →
UI-locale Edition → last-used `hindi:lang` → English:

- **The card href.** `openLang` in `src/app/_components/Dashboard.tsx` (three call
  sites: shared, purchased and available cards) is `course.langs.some(l => l.lang ===
  locale) ? locale : … "en" : … langs[0]`, from `useLocale()`. Locale-first, English
  fallback, exactly as the ticket asked.
- **The no-URL-lang redirect.** `CourseIndex` in
  `src/app/_components/CoursePanes.tsx:39-57` resolves `effLang` in the specced order,
  with the UI locale inserted *ahead* of the `localStorage` `LANG_KEY` read, and only
  when `header.editions` carries it. Its comment states the precedence verbatim.
- **`hindi:lang` is not written** by the default path — the redirect only ever reads
  it. The explicit-switch memory stayed a memory, as the ticket required.

An own-course card links to `/courses/<slug>` with no `?lang`, which is not a gap: the
redirect above is what then resolves the Edition, so a Hindi-UI owner still lands in
`hi`.
