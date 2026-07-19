# app-language-i18n/05: Learner-surface string inventory and key-naming convention

**Status:** open
**Labels:** wayfinder:grilling
**Depends on:** 04
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

With the layer locked (04), define **how learner-facing hard-coded English strings become keys**:

- **Inventory** the hard-coded chrome strings across the in-scope learner surfaces — the reader
  (nav, "Next lesson", "References", "Ask a question", progress labels), the dashboard, the catalogue
  frame, and the learner auth/checkout. (Ticket 01 cites `CourseShell.tsx:175-202` as one nest; the
  inventory should be broad enough to size the work, not necessarily exhaustive to the last string.)
- **Key-naming convention** — the namespace/key shape (matching whatever 04 chose), and the rule that
  **English is the source of truth** for keys.
- **Extraction approach** — mechanical sweep vs. as-you-touch, and where the English source strings
  land (the source catalogue/dictionary).
- **Interpolation & edge cases** — strings with variables/counts (ties into the pluralization fog),
  and strings currently built by concatenation that must be restructured into a single key.

Output: the extraction convention + a sized inventory, ready to hand to a build. Keep it ponytail —
convention first, not a giant find-replace PR.
