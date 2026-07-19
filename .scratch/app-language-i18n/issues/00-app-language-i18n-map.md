# app-language-i18n/00: Chrome i18n — map

**Status:** open
**Labels:** wayfinder:map

<!-- The canonical wayfinder map for learner-facing app-UI (chrome) internationalisation.
     This is an INDEX, not a store: each decision lives in its own ticket; the map only
     gists it and links. Load this once per session, then zoom into tickets on demand.
     Charted 2026-07-19 from .scratch/chrome-i18n/SEED-chrome-i18n.md. -->

## Destination

A **locked architecture + a build-ready spec** for **learner-facing** chrome i18n across
**English (source) + Afrikaans, Spanish, French, Hindi** — every open decision (i18n layer,
where the app-language setting lives, catalogue generation/storage, string extraction, catalogue
surface) closed and captured, so an implementer can build without any wayfinding left to do.
Shipping the code is the *next* effort, not this map.

## Notes

- **Domain:** app-UI (chrome) language ≠ content/enroll language. They are **two independent
  settings** — the founding premise (course-publishing ticket 07). An accepted state is *Spanish
  chrome around an English lesson*. Content translation already ships (the `translations` table,
  `convex/translate.ts`, the per-Edition reader switcher) — chrome-i18n **consumes it as a sibling,
  never re-charts it**.
- **Target languages (now):** English (source) + Afrikaans, Spanish, French, Hindi. All five are
  **left-to-right**.
- **Hard architecture constraint:** adding a 6th language must be a **small, cheap, data-driven
  operation** — not a code change scattered across components.
- **Scope:** learner-facing surfaces only — the reader, dashboard, catalogue, and the auth/checkout
  a learner hits.
- **App-language is personal-only and preference-resolved:** signed-in → a field on `users`; guest →
  `localStorage`. **No URL segment**, no per-locale routing.
- **Ponytail posture throughout** — four known tenants, a bounded learner base. Don't chart a
  speculative many-locale platform; the 5 languages are the target.
- **Prior art:** ticket [Global app-language picker (full chrome i18n)](01-global-app-language-picker-full-chrome-i18n.md)
  is folded in as prior art — grill *against* it (adopt / revise / reject its proposed solution
  shape), don't treat its decisions as settled. Its RTL decision is now **out of scope** (all 5
  langs are LTR).
- **Skills to consult:** `/grilling` + `/domain-modeling` (the decision core), `convex:convex-expert`
  (any `users`/`localizations` data shape), `/research` (ticket 02), `/ponytail` posture.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then zoom the link -->

_(none yet — charting session only; no tickets resolved)_

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

- **Catalogue staleness / sync.** When the learner-surface string set changes during development, how
  a language's catalogue stays in sync (a `sourceHash`-style staleness marker, mirroring
  `translations.sourceHash`). Graduates once the layer (04) and extraction (05) settle.
- **Mixed-language UX marker.** Whether to surface a subtle banner/marker when chrome language ≠ the
  content Edition's language, so the mixed state isn't read as a bug (from ticket 01's notes).
  Graduates once storage (03) + architecture (04) settle.
- **Pluralization & number/date/currency formatting** for the 5 languages — whether the platform
  `Intl` APIs suffice or a heavier layer is needed. Coarse now; graduates after 04.
- **Per-locale acceptance / QA.** How we judge a language "done" — visual QA pass across each
  learner surface. Graduates near the end.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **RTL handling.** All 5 target languages are left-to-right; ticket 01's "RTL is app-wide" decision
  is retired. Returns only if an RTL language is later wanted (a fresh effort).
- **Tenant default chrome language.** App-language is personal-only; tenants don't steer it.
- **Admin / authoring / studio surface localisation.** Operated by a small English-working owner set;
  localising them is speculative. Architecture must not *preclude* it, but it's off the route.
- **URL-encoded locale / per-locale SEO routing.** Preference-resolved only; no URL segment. Returns
  only as a fresh effort if per-locale SEO becomes real.
- **Content translation itself** — already ships (`translations`, `convex/translate.ts`, reader
  switcher). Consumed here, never re-charted.
