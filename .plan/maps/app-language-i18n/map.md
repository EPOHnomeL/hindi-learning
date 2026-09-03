# Chrome i18n

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
- **App-language is personal-only and preference-resolved:** the active locale is a **cookie** (04);
  when signed-in it is *also* persisted in a new **`userPrefs` table** and synced into the cookie at
  login (03) — **not** a `users` field (07's skip stands). Guest = **the cookie itself** (03
  superseded the original `localStorage` plan, to avoid an SSR flash). **No URL segment**, no
  per-locale routing.
- **Ponytail posture throughout** — four known tenants, a bounded learner base. Don't chart a
  speculative many-locale platform; the 5 languages are the target.
- **Prior art:** ticket [Global app-language picker (full chrome i18n)](tickets/01-global-app-language-picker-full-chrome-i18n.md)
  is folded in as prior art — grill *against* it (adopt / revise / reject its proposed solution
  shape), don't treat its decisions as settled. Its RTL decision was ruled **out of scope** here
  (all 5 langs are LTR). **Reopened elsewhere 2026-09-03**: Urdu is now a sixth chrome language
  and the app shell does flip, decided on
  [technical-foundation/09](../technical-foundation/tickets/09-chrome-rtl-strategy.md). Ticket 01's
  "RTL is app-wide" instinct was right; only its timing was wrong.
- **Skills to consult:** `/grilling` + `/domain-modeling` (the decision core), `convex:convex-expert`
  (any `users`/`localizations` data shape), `/research` (ticket 02), `/ponytail` posture.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then zoom the link -->

- [Original proposal — global picker + full chrome i18n](tickets/01-global-app-language-picker-full-chrome-i18n.md) —
  **superseded; folded into map 00 as prior art** (2026-07-19). Its founding premise (app language as a
  separate, global, preference-resolved setting independent of Edition access) was adopted; its
  app-wide-RTL and runtime-i18n-layer (Convex `localizations` + LLM generate-if-missing) proposals were
  rejected by tickets 02/04's `next-intl` + repo-JSON architecture. Not a live ticket — the map grills
  against it.

- [Research — App Router i18n approach](tickets/02-research-app-router-i18n-approach.md) — recommends
  **`next-intl` "without i18n routing"** (locale from a cookie) over an in-house `t()` layer, with
  **repo per-locale JSON** catalogues (not a Convex `localizations` table + LLM rail). Corrects ticket
  01: `convex/translate.ts` is a `PUBLISH_SECRET`-guarded **OpenRouter cloud routine** for *content*,
  wrong shape for chrome strings. `convex/languages.ts` reused for language **names** only (04 corrected
  the research's "shared registry, all 5 langs" framing: it's a ~130-entry *content* menu, so the chrome
  offer-set is the `messages/*.json` that exist, not `LANGUAGES`). Hindi chrome needs a Devanagari font.
  Full asset: [research-app-router-i18n.md](research-app-router-i18n.md). **Feeds ticket 04.**
- [Architecture — i18n layer + catalogue storage](tickets/04-architecture-i18n-layer-catalogue-storage.md) —
  **the spine, LOCKED.** Layer = **`next-intl`, "without i18n routing"**, locale from a cookie via async
  `getRequestConfig` (Server = `getTranslations`, Client = `NextIntlClientProvider`); in-house `t()`
  rejected. Catalogues = **repo `messages/<code>.json`** (static import); Convex `localizations` table +
  LLM rail rejected. The **set of chrome languages = the message files that exist** — *not* all of
  `convex/languages.ts` (that's a ~130-entry *content* menu; it only supplies names). Strings are
  **hand-authored committed JSON** (LLM may draft offline, may reuse translate.ts's OpenRouter model);
  **no runtime generation, no `convex/translate.ts` wiring**. **Add-a-language = one JSON file** (+ a
  font if a new script — Hindi/Devanagari→Noto; + a `LANGUAGES` entry only if the code isn't already
  among the ~130). **Unblocks 05 + 06.**
- [Storage, resolution order + picker](tickets/03-app-language-storage-resolution-picker.md) — **the settings-model
  half, RESOLVED.** Render source of truth = **the cookie only** (04); `getRequestConfig` never reads
  Convex. Signed-in storage = a new **`userPrefs`** table (`{ userId, locale? }`, `by_user`) — *not* a
  `users` field (07's skip stands); guest storage = **the cookie itself** (map's `localStorage` superseded
  by 04 — avoids the SSR flash). The cookie is written by three events: **explicit pick** (+ `userPrefs`
  if signed-in) → **login sync** from `userPrefs` → **one-time `Accept-Language` sniff** (mapped to an
  offered locale, else English, then persisted). Picker lives in **account settings** + a guest-reachable
  **header/footer** control; offer-set = the `messages/*.json` that exist (`en/af/es/fr/hi`), labels reused
  from `convex/languages.ts` (`langInfo`), UI mirrors `Editions.tsx`. Adds nothing to the add-a-language
  cost. Build-time key-parity check → owned by 05; mixed-language marker → still fog.
- [Catalogue localisation spec](tickets/06-catalogue-localisation-spec.md) — **the catalogue's two language axes,
  specced.** Frame strings ("Join now", filter chips, badges, empty state) = `next-intl` keys off the
  **app-language** (04); inventory owned by 05, under its `Catalogue` namespace. Card **title + mission** =
  **app-language by default, the per-card selector (course-publishing 05) overrides, English source fallback** —
  this *builds* 05's parked "localize card title+mission" deferral. Query = a **join, not new translation**: reuse
  `translatedTitle` (`lib.ts:439`) + a mirror `translatedMission` (`kind:"mission"`), no `convex/translate.ts`.
  Selector default refined to **app-language-if-that-Edition-exists-else-English** so text + Join/Buy target agree.
  **Guest path: none** — catalogue is behind `AppGate`, so title+mission always ride the signed-in app-language.
  App-language consumed as an **abstract input** (03's concept, the cookie), so ran parallel to 03.
- [Extraction — string inventory + key convention](tickets/05-string-extraction-inventory-key-convention.md) —
  **key convention + extraction, RESOLVED.** Keys = **`next-intl` nested namespaces by surface**
  (`Common`/`Reader`/`Dashboard`/`Catalogue`/`Auth`/`Editions`); **English `en.json` is the source of
  truth**, key names semantic (re-wording English never renames a key). Extraction = **one bounded
  mechanical sweep** of the ~8 in-scope learner components (~90–120 keys), not as-you-touch (half-English
  chrome reads as a bug). Interpolation/counts = ICU (one key each); concatenations restructured to a
  single whole-sentence key. **Key-parity fog item closed:** a `vitest` test asserts every
  `messages/<code>.json` carries exactly `en.json`'s leaf keys — **CI fails on drift** (no runtime
  `sourceHash`, no Convex rail). Devanagari chrome needs the app-shell font per 04's escape hatch.

## Not yet specified

<!-- in-scope fog: real but not yet sharp enough to ticket; graduates as the frontier advances -->

- **~~Catalogue staleness / sync.~~ Closed by 05** — specced as a build-time **key-parity
  `vitest` test** ("every `messages/<code>.json` carries exactly `en.json`'s leaf keys; CI fails on
  drift"), owned by ticket 05. No longer fog.
- **Mixed-language UX marker.** Whether to surface a subtle banner/marker when chrome language ≠ the
  content Edition's language, so the mixed state isn't read as a bug (from ticket 01's notes).
  Graduates once storage (03) + architecture (04) settle.
- **~~Pluralization & number/date/currency formatting.~~ Resolved by 04** — absorbed into the
  `next-intl` layer choice: ICU message format + `Intl` give pluralization and number/date/currency
  formatting for free. No longer fog, not a separate ticket.
- **Per-locale acceptance / QA.** How we judge a language "done" — visual QA pass across each
  learner surface. Graduates near the end.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **RTL handling.** All 5 target languages of *this* map are left-to-right, so ticket 01's
  "RTL is app-wide" decision was retired here. It returns the moment an RTL language is wanted.
  **That happened on 2026-08-04**, when the operator asked for Urdu in settings. This bullet stays
  out of scope: the RTL work consumes this map's architecture and owns the direction question
  itself. Where it actually lives, after the 2026-09-01 `.plan` consolidation split the old
  `urdu-chrome-locale` map across two homes:
  - the catalogue half is
    [translation-and-locales/08](../translation-and-locales/tickets/08-urdu-message-catalogue.md);
  - the RTL spine is [technical-foundation/09](../technical-foundation/tickets/09-chrome-rtl-strategy.md)
    (strategy) and [10](../technical-foundation/tickets/10-rtl-app-shell.md) (build).
  All three were resolved 2026-09-03.
- **Tenant default chrome language.** App-language is personal-only; tenants don't steer it.
- **Admin / authoring / studio surface localisation.** Operated by a small English-working owner set;
  localising them is speculative. Architecture must not *preclude* it, but it's off the route.
- **URL-encoded locale / per-locale SEO routing.** Preference-resolved only; no URL segment. Returns
  only as a fresh effort if per-locale SEO becomes real.
- **Content translation itself** — already ships (`translations`, `convex/translate.ts`, reader
  switcher). Consumed here, never re-charted.
