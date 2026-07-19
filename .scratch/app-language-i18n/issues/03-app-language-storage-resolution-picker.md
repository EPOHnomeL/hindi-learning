# app-language-i18n/03: App-language storage, resolution order, and picker

**Status:** open
**Labels:** wayfinder:grilling
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

Decide the **settings-model half** of chrome-i18n — orthogonal to the rendering layer (04), so this
sits on the frontier. Resolve:

- **Where a signed-in user's app-language lives.** A new locale field on the `users` table, or a
  small separate `userPrefs` row? (Note: course-publishing ticket 07 deliberately did *not* add a
  `users` locale field — this ticket revisits that with chrome-i18n as the actual consumer.)
- **Where a guest's app-language lives.** `localStorage` (chrome is not access-controlled — only
  content is — so a guest may pick any of the 5 freely).
- **The resolution order** for the active locale on first load and thereafter, e.g.:
  explicit user choice → stored preference (users field / localStorage) → browser `Accept-Language`
  (mapped to one of the 5, else English) → English. Confirm whether `Accept-Language` sniffing is
  wanted at all, or whether unset simply means English.
- **The picker.** Where it lives (app header? dashboard? account settings?) and the **shared ISO-639
  list** (code + English name + native name) reused with the content-translation Edition picker —
  is there an existing list to reuse (`convex/translate.ts` / the reader's language switcher)?

**Constraints from the map:** personal-only (no tenant default), preference-resolved (no URL
segment), 5 languages now with a cheap path to add more. Keep it ponytail — the smallest storage +
resolution that works.
