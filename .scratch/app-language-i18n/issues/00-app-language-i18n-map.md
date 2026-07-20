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

- [Research — App Router i18n approach](02-research-app-router-i18n-approach.md) — recommends
  **`next-intl` "without i18n routing"** (locale from a cookie) over an in-house `t()` layer, with
  **repo per-locale JSON** catalogues (not a Convex `localizations` table + LLM rail). Corrects ticket
  01: `convex/translate.ts` is a `PUBLISH_SECRET`-guarded **OpenRouter cloud routine** for *content*,
  wrong shape for chrome strings. `convex/languages.ts` already is the shared language registry (all 5
  langs) — reuse it (pre-answers ticket 03's shared-list note). Hindi chrome needs a Devanagari font.
  Full asset: [research-app-router-i18n.md](research-app-router-i18n.md). **Feeds ticket 04.**
- [Architecture — i18n layer + catalogue storage](04-architecture-i18n-layer-catalogue-storage.md) —
  **the spine, LOCKED.** Layer = **`next-intl`, "without i18n routing"**, locale from a cookie via async
  `getRequestConfig` (Server = `getTranslations`, Client = `NextIntlClientProvider`); in-house `t()`
  rejected. Catalogues = **repo `messages/<code>.json`** (static import); Convex `localizations` table +
  LLM rail rejected. The **set of chrome languages = the message files that exist** — *not* all of
  `convex/languages.ts` (that's a ~130-entry *content* menu; it only supplies names). Strings are
  **hand-authored committed JSON** (LLM may draft offline, may reuse translate.ts's OpenRouter model);
  **no runtime generation, no `convex/translate.ts` wiring**. **Add-a-language = one JSON file** (+ a
  font if a new script — Hindi/Devanagari→Noto; + a `LANGUAGES` entry only if the code isn't already
  among the ~130). **Unblocks 05 + 06.**

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

- **Catalogue staleness / sync.** With repo JSON locked (04), this is **no longer a runtime
  `sourceHash` problem** but a **build-time key-parity check** ("every `messages/*.json` carries exactly
  `en.json`'s keys"). Ticket 04 deliberately did **not** fold the guard in — it **graduates with ticket
  05 (extraction)**, which owns the source key set.
- **Mixed-language UX marker.** Whether to surface a subtle banner/marker when chrome language ≠ the
  content Edition's language, so the mixed state isn't read as a bug (from ticket 01's notes).
  Graduates once storage (03) + architecture (04) settle.
- ~~**Pluralization & number/date/currency formatting.**~~ **Resolved by 04** — absorbed into the
  `next-intl` layer choice: ICU message format + `Intl` give pluralization and number/date/currency
  formatting for free. No longer fog, not a separate ticket.
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
