# 08 — Course settings (from dashboard) edits the UI-locale edition

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
