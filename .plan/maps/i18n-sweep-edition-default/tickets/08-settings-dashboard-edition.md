---
type: task
blocked_by: []
---

# Course settings (from dashboard) edits the UI-locale edition

## Question

Depends on 01 (dialog takes a target `lang` and self-resolves the edition).

- `src/app/_components/Dashboard.tsx`: where `CourseSettingsDialog` is opened
  (L363), pass `lang` = the UI locale (`useLocale()`) when it is non-`en` and
  present in `course.editions`; else `"en"`/undefined.
- Result: opening settings on a course that has a Hindi edition, with UI=Hindi,
  shows/edits the Hindi edition's translated title & mission (via
  EditionDetailsSection), falling back to English source otherwise.

Done when: dashboard settings on a matching-locale course edits the translated
edition; non-matching course still edits English source; reader entry point
unchanged in behaviour.

## Done when

Dashboard settings on a matching-locale course edits the translated edition; a non-matching course still edits the English source; the reader entry point is unchanged in behaviour.

<!-- Migrated 2026-07-30 from GitHub issue #71 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

## Answer

**Already built when this ticket was migrated — resolved 2026-08-18 by reading the tree.**
Verified by evidence, not by walking a browser.

Same commit as [ticket 07](07-open-course-locale-default.md): `cd1ddeb` (2026-07-21,
*feat(editions): open courses and course settings in the UI language*), nine days
before this ticket was migrated in.

`src/app/_components/Dashboard.tsx` computes `settingsLang = locale !== "en" &&
course.editions.includes(locale) ? locale : "en"` from `useLocale()`, and passes it as
`CourseSettingsDialog`'s `lang` prop. So dashboard settings on a course that has an
Edition in the active locale edits that translated Edition's title and mission; any
other course falls back to `"en"`, the English source. The reader entry point is
untouched — it resolves its own Edition from the URL, as before.

The dependency this ticket declared on ticket 01 (the dialog taking a target `lang` and
self-resolving the Edition) is satisfied: the dialog takes `lang` as a prop and
`EditionDetailsSection` resolves the Edition from it.
