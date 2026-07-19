# Research — App Router i18n approach for chrome-i18n (ticket 02 asset)

**For:** [`app-language-i18n/02`](issues/02-research-app-router-i18n-approach.md) · feeds the ticket 04
architecture decision. **Date:** 2026-07-19. **Decides nothing** — options + a recommendation.

## Constraints this must satisfy (from the map)

1. **No URL locale segment** — locale is a personal, preference-resolved value (users field /
   localStorage), never `/es/…`, no middleware locale rewrite.
2. **Trivial to add a language** — adding a 6th must be a cheap, data-driven operation.
3. Next.js **15.2.3** App Router + **React 19**; **no i18n dependency today**; learner surfaces only;
   all 5 target languages (en, af, es, fr, hi) are **LTR**.

## Codebase facts pinned (verified against `main`)

- **`convex/languages.ts` already is the shared language registry** — a plain data module imported by
  both backend and client. It exports `LANGUAGES` (code + English name + `native` endonym + `rtl`),
  `isKnownLang`, `langInfo` (graceful fallback), `langDir` (`ltr`/`rtl`), `isRtl`, `isDevanagari`. It
  **already contains all 5 target languages** (`af`, `es`, `fr`, `hi`, + `en` = source). ⇒ ticket 03's
  "shared ISO-639 list" need is **already met** — reuse this module, don't build a second list.
- **`convex/translate.ts` is NOT an in-app Claude call.** It is a cloud **translate Routine** driven
  outside the app (ADR 0001: no LLM and no API key in the app), talking to **OpenRouter**
  (`openrouterClient`, `translateModel`), publishing back through a `PUBLISH_SECRET`-guarded seam. It
  translates per-`(Topic, language)` *content* (lessons/references/title/mission/Q&A), with a
  `sourceHash` staleness cache and a lock→claim→materialise→publish→report lifecycle. ⇒ ticket 01's
  assumption of reusing "the same Claude-Messages-API path" for chrome strings is **outdated** and the
  shape is wrong for a small fixed UI-string set (see §4).
- **Hindi needs a Devanagari-capable chrome font.** The reader already special-cases this for content
  (`isDevanagari` → Noto Devanagari in `buildSrcDoc`, because the `Spectral` body font has no
  Devanagari glyphs). The chrome will hit the same problem for Hindi UI text — flag for the build.

## Options

### A. `next-intl` in "without i18n routing" mode — **recommended**

next-intl officially supports the App Router **without a locale in the URL**: set `localePrefix`
irrelevant / no routing, and resolve the locale yourself inside `getRequestConfig` — the canonical
example reads it from a **cookie** with an English fallback:

```ts
// i18n/request.ts
import {cookies} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('locale')?.value || 'en';
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
```

Client components get messages via `NextIntlClientProvider` in the root layout; server components use
`getTranslations`. `getRequestConfig` is **async**, so `messages` can be a static JSON import **or**
fetched at runtime (from a DB/API) — the mechanism doesn't force either.

- **Pros:** mature, App-Router-native (Server + Client Components), ICU message format so
  **pluralization + number/date formatting come free** (retires part of that fog), `Intl`-based, tiny
  boilerplate. Cookie-driven locale is exactly the "preference-only, no URL" model we chose.
- **Cons:** a dependency; ICU syntax is a (mild) convention to learn.
- **"Add a language":** drop `messages/<code>.json`, ensure the code is in `LANGUAGES` — that's it.

### B. `use-intl` (next-intl's framework-agnostic core)

Same API as A minus the Next.js server integration. Only worth it if we deliberately avoid the
server-side request config; for an App Router app, A is the better-integrated form of the same thing.

### C. `react-intl` (FormatJS)

Pure runtime, **no routing at all** — you feed it `locale` + `messages` via `<IntlProvider>`. Works
fine without URL locales. Also ICU. Heavier/less App-Router-idiomatic than next-intl for Server
Components; no real advantage here.

### D. In-house lightweight `t(key)` layer (ticket 01's proposal)

A dictionary loaded per-locale with English fallback, keyed lookups behind `t()`. Minimal deps, full
control.

- **Cons:** reinvents pluralization, interpolation, `Intl` formatting, Server/Client wiring, missing-
  key fallback — all of which A gives for free. Under ponytail, **adopt before build**: this is the
  standard-library-vs-hand-roll call, and the library wins unless A proves unworkable.

## Where the message catalogues should live — repo JSON vs Convex `localizations` table

| | Repo per-locale JSON (**recommended**) | Convex `localizations` table (ticket 01) |
|---|---|---|
| Fits option A | native (static import or bundled) | possible (runtime fetch in `getRequestConfig`) |
| "Add a language" | add one JSON file (+ `LANGUAGES` entry) | insert rows / run a generation job |
| Who adds languages | **developers** (matches our reality — known set, owners work in English) | non-devs at runtime (a capability we **ruled out**) |
| Generation | translate once, commit (LLM may *draft* offline) | build an LLM generation + `sourceHash` rail |
| Complexity | lowest — no table, no rail, no cache-invalidation | a whole subsystem |

The Convex-table + LLM-generation approach ticket 01 sketched only earns its complexity if languages
are added **at runtime by non-developers**. We ruled that out (personal-only, fixed known set). So the
**ponytail recommendation is repo JSON**; 04 should consciously reject the Convex rail rather than
inherit it from 01.

## Should `convex/translate.ts` generate chrome catalogues? — **No**

It's a guarded cloud routine for per-Topic *content*, with a staleness lifecycle sized for large,
frequently-changing, per-course bodies. Chrome is a **small (~100–200), fixed, hand-authorable** UI
string set shared across all courses. Wiring it into the content rail is a category error. If we want
LLM help, draft the JSON **offline** once per language and commit it — no runtime dependency, no
`PUBLISH_SECRET` seam, no per-render cost.

## Recommendation to ticket 04 (to decide, not settled here)

1. **Adopt `next-intl` (option A), "without i18n routing", locale from a cookie** mirroring the users-
   field/localStorage preference (ticket 03 owns the storage + cookie-sync).
2. **Repo per-locale JSON** message catalogues; **reject** the Convex `localizations` table + LLM
   generation rail (over-built for a fixed, dev-maintained set).
3. **Reuse `convex/languages.ts`** for the picker menu + native names; do not build a second list.
4. Set `<html lang>` from the active locale; `dir` stays `ltr` (RTL out of scope) but `langDir` is
   available if that ever changes.
5. Give Hindi chrome a **Devanagari-capable font**, mirroring the reader's `isDevanagari`/Noto handling.

## Sources

- [next-intl — App Router setup](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl — App Router without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
- [next-intl — Request configuration (`getRequestConfig`)](https://next-intl.dev/docs/usage/configuration)
- [next-intl — Getting locale from cookie (discussion #2205)](https://github.com/amannn/next-intl/discussions/2205)
