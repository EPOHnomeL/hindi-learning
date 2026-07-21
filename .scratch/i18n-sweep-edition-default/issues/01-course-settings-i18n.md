# 01 — CourseSettings modal → next-intl

Wire `src/app/_components/CourseSettings.tsx` to next-intl. New namespace
`CourseSettings` in `messages/en.json`.

Cover: dialog title; Details heading/body/labels/placeholder; EditionDetails
heading (`Details — {native}`)/body/labels; Lessons heading/body/empty/loading;
per-row delete label+title; both ConfirmDialogs (title/body/confirmLabel, with
`{title}` interpolation); Completion (both states); all Save/Saving/Saved/Reopen/
Mark-complete button states.

Also (feeds issue 08): change the dialog to take a target `lang` prop and
self-resolve — when `lang && lang !== "en"` fetch `courseHeader({topicSlug, lang})`
and render EditionDetailsSection from it; else DetailsSection. Update the reader's
`CourseSettingsButton` to pass its content lang instead of a prebuilt edition obj.

Done when: modal fully renders in the active locale; en.json has the keys; tsc
clean.
