# 06 — Dashboard gaps + shared ui.tsx → next-intl

`src/app/_components/Dashboard.tsx` (already partly wired): NewCourseCard (New
course, title/mission placeholders, Teacher + provider options + experimental note,
Resources copy, remove link/file aria, Add link, attach-file(s) plural, Create/
Creating, Cancel, per-day error); AdminCourseMenu (trigger label `{title}`, cancel/
finish states); progress `title=` estimate tooltip. Reuse `Dashboard` namespace.

`src/app/_components/ui.tsx`: shared `Dialog` Close (L91) and `ConfirmDialog` Cancel
(L328). Make the primitive pull `Common` (`useTranslations`) with an optional label
prop override, so every dialog gets a localized Close/Cancel. Add `Common.close`,
`Common.cancel`.

Keep "My Course"/Admin brand strings as-is.

Done when: these render in the active locale; keys in en.json; tsc clean.
