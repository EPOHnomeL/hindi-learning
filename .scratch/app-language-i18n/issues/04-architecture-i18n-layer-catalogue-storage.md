# app-language-i18n/04: Architecture decision — the i18n layer and catalogue storage

**Status:** done
**Claimed:** 2026-07-20 (ticket-04 architecture grilling session)
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

## Resolution — 2026-07-20 (grilling session)

Grilled the four decisions one at a time against ticket 02's research and ticket 01's shape. All four
land where the research recommended (the research is endorsed, not rubber-stamped — decision 3 was
re-grilled after an initial answer collided with decision 2, see below). **The architecture is locked.**

### 1. The i18n layer → `next-intl`, "without i18n routing"

Adopt **`next-intl`** in its App-Router-native no-locale-routing mode; the active locale is resolved
inside an async `getRequestConfig` from a **cookie** with an English fallback (never a URL segment).
Server Components use `getTranslations`; Client Components get messages via `NextIntlClientProvider`
in the root layout. Rejected the in-house `t(key)` layer (ticket 01): it reinvents pluralization,
interpolation, `Intl` formatting, Server/Client wiring and missing-key fallback — all of which
`next-intl` gives for free. Under ponytail this is the standard-library-vs-hand-roll call and the
library wins. `use-intl`/`react-intl` add nothing over the better-integrated `next-intl` here.

- **Fog collapsed:** *Pluralization & number/date/currency formatting* is **absorbed into this choice**
  — ICU message format + `Intl` come free with `next-intl`. It is no longer a separate concern.
- `<html lang>` is set from the active locale; `dir` stays `ltr` (RTL out of scope). `langDir` from
  `convex/languages.ts` is available if that ever changes.

### 2. Where catalogues live → repo per-locale JSON; the files define the offer-set

Catalogues are **`messages/<code>.json` committed in-repo**, statically imported by `next-intl`.
**Rejected** ticket 01's Convex `localizations` table + runtime generation: it only earns its
complexity if non-developers add chrome languages at runtime, which the map rules out (personal-only,
fixed known set, owners work in English).

- **Seam pinned (correction to the research):** `convex/languages.ts` is **not** a "5-language
  registry" — it is a **~130-entry picker menu** (major languages + romanized `-Latn` variants) built
  for the *content-Edition* picker, and it already contains the 5 chrome targets. So the chrome picker
  **cannot** just render `LANGUAGES`. The **set of chrome languages = the `messages/*.json` files that
  exist**; `LANGUAGES` supplies display/native names for those files only. This avoids the "learner
  picks Telugu chrome, silently gets English" broken state. The picker *widget* belongs to ticket 03;
  ticket 03 renders over this offer-set, not over all of `LANGUAGES`.

### 3. How a string is translated → hand-authored JSON, offline LLM draft optional

Committed **`messages/<code>.json` is the source of truth**, human-reviewed. An LLM may **draft** a new
language's file **offline** as a one-off dev convenience — it may even reuse the same OpenRouter model
`convex/translate.ts` uses — but the artifact is reviewed committed JSON. **No runtime generation, no
`convex/translate.ts` wiring, no Convex `sourceHash` rail.**

- **Re-grilled:** the initial pick ("generate via `convex/translate.ts`") was surfaced as incoherent
  with decision 2 and reversed. `convex/translate.ts` publishes into Convex **content tables** keyed
  per-`(Topic, language)` via the `PUBLISH_SECRET` seam (ADR 0001: no LLM key in the app), driven as a
  cloud Routine from *outside* the app. Chrome has no `Topic`, isn't a per-course body, and can't call
  that path in-app. Reuse the translation *idea/quality* offline; do not wire chrome into the content
  rail — it's a category error.

### 4. Adding the 6th language (the acceptance test)

The maintainer operation is **one JSON file**, with two named escape hatches:

1. Add `messages/<code>.json` with full key coverage of `en.json` (LLM-drafted offline + reviewed).
2. Ensure `<code>` is in `LANGUAGES` — **usually already true** (~130 codes listed), so typically
   **zero code change**.
3. The chrome picker offers it **automatically** (offer-set = the message files that exist).
4. **Escape hatch A — new script:** may need a font. Hindi/Devanagari is the live case — mirror the
   reader's `isDevanagari` → **Noto Devanagari** handling for chrome UI text (the `Spectral` body font
   has no Devanagari glyphs). **Escape hatch B — new RTL language:** out of scope (a fresh effort).

Acceptance bar recorded honestly: *"one JSON file — plus a font if it's a new script, plus a
`LANGUAGES` entry only if the code isn't already among the ~130 listed."* (The user declined folding a
key-parity build guard in here — see Downstream.)

### Downstream / fog

- **Unblocks ticket 05 (extraction)** and **ticket 06 (catalogue surface)** — both build on repo
  `messages/*.json` behind `next-intl`, no wayfinding left.
- **Catalogue staleness / sync** stays fog and **graduates with ticket 05**: with repo JSON it is no
  longer a runtime `sourceHash` problem but a **build-time key-parity check** ("every `messages/*.json`
  has exactly `en.json`'s keys"). The user chose *not* to fold that guard into ticket 04, so it belongs
  to 05.
- **Boundary held:** ticket 03 owns the *user's app-language setting* (users-field vs `userPrefs`,
  guest `localStorage`, resolution order, the picker widget, cookie-sync). Ticket 04 owns only the
  *rendering layer + catalogue storage*. The cookie that `getRequestConfig` reads is written by 03.
