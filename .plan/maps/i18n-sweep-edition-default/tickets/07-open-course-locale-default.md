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
