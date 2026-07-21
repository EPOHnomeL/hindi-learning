# 03 — ArtifactView (reader) → next-intl

Wire `src/app/_components/ArtifactView.tsx`. Reuse `Reader` namespace; add keys.

Cover: lesson/reference not-found + load-failed; Mark complete/Completed; Next
lesson; edit aria/title/label ("✎ Edit", `Edit {label}`, Cancel, Save/Saving,
upload error); NextLessonButton all states (generating/all-caught-up/generated-
today/retry/failed/starting + titles); copy toast; QuestionBox (heading, ask
placeholder, Ask, empty, Teacher, View, waiting); QaDialog (Close, Teacher).

Done when: reader renders in the active locale; keys in en.json; tsc clean.
