# app-language-i18n/02: Research — App Router i18n approach for a no-URL-locale, runtime-addable app

**Status:** open
**Labels:** wayfinder:research
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

Given this app is **Next.js 15 App Router + React 19** with **no i18n framework today**, survey the
realistic ways to localise **learner-facing chrome** under two firm constraints from the map:

1. **No URL locale segment** — locale is a personal, preference-resolved value (no `/es/…` routing,
   no middleware locale rewrite).
2. **Trivial to add a language** — adding a 6th language must be a cheap, data-driven operation.

Produce a **markdown summary** (linked as an asset) that lays out the options and a recommendation,
covering at least:

- **`next-intl` / `react-intl` / `use-intl` without locale routing** — do they work cleanly when the
  locale is *not* in the URL (set programmatically per request/render)? What's the cost of adding a
  language (static JSON in-repo vs. dynamic)?
- **A lightweight `t(key)` layer** over per-locale dictionaries — the shape ticket 01 proposed. What
  it costs to build vs. adopt.
- **Where dictionaries can live** — in-repo JSON (build-time, 5 known langs) vs. a Convex
  `localizations` table loaded at runtime (ticket 01's proposal). Trade-offs for the "trivial to add"
  constraint and for Server vs. Client Components.
- **Reusing `convex/translate.ts`** — can/should the existing Claude-API content-translation path
  generate the chrome string catalogues too, or is that the wrong tool for a fixed, hand-authorable
  string set? Read `convex/translate.ts` and the `translations` table before answering.

This ticket **decides nothing** — it feeds ticket 04 (the architecture decision). Output is the
options doc + a recommendation, not a chosen framework.
