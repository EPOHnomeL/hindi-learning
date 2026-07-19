# app-language-i18n/04: Architecture decision — the i18n layer and catalogue storage

**Status:** open
**Labels:** wayfinder:grilling
**Depends on:** 02
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

The spine decision. Using ticket 02's research and grilling *against* ticket 01's proposed shape,
**lock the chrome-i18n architecture**:

- **The i18n layer** — a chosen framework (e.g. `next-intl`/`use-intl` without locale routing) vs. a
  lightweight in-house `t(key)` layer. Must work across the App Router's Server and Client
  Components and satisfy "trivial to add a language".
- **Where the string catalogues live** — in-repo per-locale JSON (build-time, 5 known langs) vs. a
  Convex `localizations` table loaded at runtime (ticket 01's proposal). Decide against the
  "trivial to add" constraint and the personal/preference resolution model (ticket 03).
- **How a string is translated** — hand-authored per language, vs. generated via the same
  Claude-API path `convex/translate.ts` uses for content. Ticket 01 assumed LLM generation with a
  `sourceHash` cache; challenge that for a *fixed, small, hand-authorable* chrome string set under
  ponytail.
- **How adding the 6th language actually works** end-to-end, concretely — the operation a maintainer
  performs. This is the acceptance test for the whole decision.

Output: a locked decision recorded on the map, precise enough that ticket 05 (extraction) and ticket
06 (catalogue surface) can build on it. Unblocks 05 and 06.
