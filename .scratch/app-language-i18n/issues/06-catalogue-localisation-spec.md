# app-language-i18n/06: Catalogue (marketplace) localisation spec

**Status:** open
**Labels:** wayfinder:grilling
**Depends on:** 04
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

Spec how the **course catalogue** localises. It has two halves that ride different languages —
name the seam and decide both:

- **Card frame strings** (app-language) — "Enroll", "Free", "Continue", filter/sort labels, empty
  states. These key off the app-language via the layer chosen in 04.
- **Card title + mission** (content-language) — the catalogue query today returns only
  source-language title/mission. Translated title/mission **already exist** in the `translations`
  table (`kind: "title"` / `kind: "mission"`), so this is a query join, not new translation.
  **This absorbs course-publishing ticket 05's parked follow-up** — cross-referenced there.

Decide:

- **Which language drives a card's title + mission** — the app-language as a browse default, a
  dedicated catalogue content-language filter, or the viewer's held-Edition language? Name the rule
  and how it interacts with the app-language.
- **The catalogue query change** — how the catalogue query joins `translations` for the chosen
  language, with English source fallback when a translation is absent.
- **Guest vs. signed-in** behaviour on the catalogue (chrome is not access-controlled).

Output: a spec for the localised catalogue covering both halves. Depends on 04 for the frame-string
layer.
