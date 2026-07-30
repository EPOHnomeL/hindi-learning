---
type: grilling
blocked_by: [02]
---

# Architecture decision — the i18n layer and catalogue storage

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

## Done when

All four decisions (layer, catalogue storage, translation method, and the concrete add-a-6th-language
operation) are locked, precise enough for tickets 05 and 06 to build on with no wayfinding left.

## Answer

Resolved 2026-07-20 (grilling session). Grilled the four decisions one at a time against ticket 02's
research and ticket 01's shape; all four land where the research recommended (endorsed, not
rubber-stamped — decision 3 was re-grilled after colliding with decision 2). **The architecture is
locked.**

**1. The i18n layer → `next-intl`, "without i18n routing".** App-Router-native no-locale-routing mode;
the active locale is resolved inside an async `getRequestConfig` from a **cookie** with an English
fallback (never a URL segment). Server Components use `getTranslations`; Client Components get messages
via `NextIntlClientProvider` in the root layout. Rejected the in-house `t(key)` layer (01): it reinvents
pluralization, interpolation, `Intl` formatting, Server/Client wiring and missing-key fallback — all
free with `next-intl`. `use-intl`/`react-intl` add nothing over the better-integrated `next-intl`.
*Fog collapsed:* pluralization & number/date/currency formatting is absorbed into this choice (ICU +
`Intl` come free). `<html lang>` set from the active locale; `dir` stays `ltr` (RTL out of scope);
`langDir` from `convex/languages.ts` is available if that changes.

**2. Where catalogues live → repo per-locale JSON; the files define the offer-set.** `messages/<code>.json`
committed in-repo, statically imported by `next-intl`. **Rejected** ticket 01's Convex `localizations`
table + runtime generation: it only earns its complexity if non-developers add chrome languages at
runtime, which the map rules out. **Seam pinned (correction to the research):** `convex/languages.ts` is
**not** a "5-language registry" — it is a ~130-entry picker menu built for the *content-Edition* picker
that already contains the 5 chrome targets, so the chrome picker cannot just render `LANGUAGES`. The
**set of chrome languages = the `messages/*.json` files that exist**; `LANGUAGES` supplies display/native
names for those files only. This avoids the "learner picks Telugu chrome, silently gets English" broken
state. The picker widget belongs to ticket 03, rendering over this offer-set.

**3. How a string is translated → hand-authored JSON, offline LLM draft optional.** Committed
`messages/<code>.json` is the source of truth, human-reviewed. An LLM may **draft** a new language's file
**offline** as a one-off dev convenience (may even reuse the OpenRouter model `convex/translate.ts` uses),
but the artifact is reviewed committed JSON. **No runtime generation, no `convex/translate.ts` wiring, no
Convex `sourceHash` rail.** *Re-grilled:* the initial pick ("generate via `convex/translate.ts`") was
incoherent with decision 2 and reversed — `convex/translate.ts` publishes into Convex content tables per
`(Topic, language)` via `PUBLISH_SECRET` (ADR 0001: no LLM key in the app), driven as a cloud Routine from
outside the app; chrome has no `Topic` and can't call that path in-app. Reuse the translation idea/quality
offline; don't wire chrome into the content rail.

**4. Adding the 6th language (the acceptance test).** The maintainer operation is **one JSON file**, with
two named escape hatches: (1) add `messages/<code>.json` with full key coverage of `en.json` (LLM-drafted
offline + reviewed); (2) ensure `<code>` is in `LANGUAGES` — usually already true (~130 codes), so
typically **zero code change**; (3) the chrome picker offers it automatically (offer-set = the message
files that exist); (4) **escape hatch A — new script:** may need a font (Hindi/Devanagari is the live case
— mirror the reader's `isDevanagari` → **Noto Devanagari**; the `Spectral` body font has no Devanagari
glyphs); **escape hatch B — new RTL language:** out of scope (a fresh effort). Acceptance bar recorded
honestly: *"one JSON file — plus a font if it's a new script, plus a `LANGUAGES` entry only if the code
isn't already among the ~130 listed."*

**Downstream / fog:** unblocks ticket 05 (extraction) and ticket 06 (catalogue surface), both building on
repo `messages/*.json` behind `next-intl`. Catalogue staleness/sync stays fog and graduates with ticket
05 — with repo JSON it is a **build-time key-parity check**, not a runtime `sourceHash` problem; the user
chose *not* to fold that guard into 04, so it belongs to 05. Boundary held: ticket 03 owns the user's
app-language setting (storage, resolution order, picker widget, cookie-sync); ticket 04 owns only the
rendering layer + catalogue storage. The cookie `getRequestConfig` reads is written by 03.
