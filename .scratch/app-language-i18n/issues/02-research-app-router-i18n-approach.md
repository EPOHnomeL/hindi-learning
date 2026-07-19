# app-language-i18n/02: Research — App Router i18n approach for a no-URL-locale, runtime-addable app

**Status:** done (2026-07-19, session 782007d9)
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

## Resolution (2026-07-19)

Asset: **[research-app-router-i18n.md](../research-app-router-i18n.md)** — full options survey + a
recommendation for ticket 04.

**Findings, in brief:**

- **`next-intl` works cleanly without a URL locale** — App Router "without i18n routing" mode reads the
  locale from a **cookie** in an async `getRequestConfig` (English fallback). Server + Client
  Components supported; ICU format gives pluralization + `Intl` formatting for free. This is the
  recommended layer; an in-house `t()` layer (ticket 01's proposal) reinvents it.
- **Catalogues should be repo per-locale JSON, not a Convex `localizations` table.** The Convex-table
  + LLM-generation rail ticket 01 sketched only pays off if non-developers add languages at runtime —
  which the map ruled out (personal-only, fixed known set, owners work in English). Repo JSON makes
  "add a language" = add one file + one `LANGUAGES` entry.
- **`convex/translate.ts` should NOT generate chrome strings.** Correction to ticket 01: it's a
  `PUBLISH_SECRET`-guarded **cloud routine over OpenRouter** for per-Topic *content* (ADR 0001 — no
  LLM/key in the app), not an in-app Claude call. Wrong shape for a small fixed UI-string set. Draft
  JSON offline once per language if LLM help is wanted; commit it.
- **`convex/languages.ts` already is the shared language registry** — has all 5 target languages +
  `langInfo`/`langDir`/`isDevanagari`. Reuse it (this pre-answers ticket 03's "shared ISO list" note).
- **Hindi chrome needs a Devanagari-capable font**, mirroring the reader's existing `isDevanagari`/Noto
  handling — flag for the build.
