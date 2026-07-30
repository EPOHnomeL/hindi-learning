---
type: task
blocked_by: []
---

# Global app-language picker (full chrome i18n)

## Question

Localise the app *chrome* (nav, buttons — "Next lesson", "References", "Ask a question" —
progress labels, the dashboard, empty states) so the whole reader is localisable, not just the
Edition content. Vocabulary: an **Edition** = a `(Topic, language)` pair (the unit of content
access); **App language** = the reader's global UI-locale preference, distinct from which
Editions they can access. The course-translation feature this depends on translates authored
*content* per Edition; the chrome around it stays English, so a learner reading a Spanish
edition still sees an English frame.

Proposed solution shape (from the 2026-07-06 grilling session, to grill *against*, not settled):

- **App language is a separate, global preference** — sticky across every page, independent of
  which Editions the reader can access. An accepted state is *Spanish chrome around an English
  lesson*.
- **RTL is app-wide** — when the app language is right-to-left the whole layout flips (`dir="rtl"`
  on the document), not just the content iframe.
- **Storage:** signed-in users get a locale field (on `users` or a small `userPrefs` row); guests
  use `localStorage` (chrome is not access-controlled). A picker in the header/dashboard sets it,
  sharing the searchable ISO-639 list (code + English name + native name + RTL flag) with the
  Edition picker.
- **A `localizations` catalog, app-wide (NOT per course)** — UI strings translated once per
  language and cached in Convex (`localizations` table keyed by language, English source),
  generated via the same Claude-Messages-API path the content translator uses, generate-if-missing.
- **A runtime i18n layer, not a build-time framework** — a lightweight per-locale dictionary
  loaded from Convex with English fallback, behind a `t(key)` lookup; static build-time catalogs
  (next-intl/react-intl) assumed not to fit because languages are added at runtime.

Out of scope (this ticket): content translation and Edition access (the dependency feature),
selling/monetisation, and admin/authoring surfaces beyond the learner reader + dashboard.

## Done when

The learner-facing chrome (reader, dashboard, empty states, and the auth/checkout a learner hits)
is fully localisable behind a single global app-language preference, with the English strings
extracted from hard-coded JSX into keyed catalogue lookups.

## Answer

**Superseded — folded into map 00 as prior art on 2026-07-19** (imported from GitHub #14 on
2026-07-15; the GitHub issue was deleted after import). This is not a live ticket: it is the
proposal the map grills *against*, and its decisions were adopted, revised, or rejected downstream:

- **Adopted:** "app language is a separate, global, preference-resolved setting, independent of
  Edition access" — the founding premise of the whole map.
- **Rejected — RTL is app-wide:** now **out of scope**. All five target languages (English,
  Afrikaans, Spanish, French, Hindi) are left-to-right; RTL returns only as a fresh effort.
- **Rejected — runtime i18n layer + Convex `localizations` table + LLM generate-if-missing:**
  ticket 02's research and ticket 04's architecture lock chose **`next-intl` "without i18n routing"**
  with **repo per-locale `messages/<code>.json`**, hand-authored (LLM may draft offline). The
  in-house `t()` layer reinvents pluralization/interpolation/`Intl`/Server-Client wiring that
  `next-intl` gives free; the Convex + LLM rail only pays off if non-developers add languages at
  runtime, which the map rules out.
- **Revised — guest `localStorage`:** superseded by 03 (the cookie itself, to avoid an SSR
  flash-of-English). Signed-in storage landed as a new `userPrefs` table, not a `users` field.
- **Corrected — reusing `convex/translate.ts`:** it is a `PUBLISH_SECRET`-guarded OpenRouter cloud
  routine for per-Topic *content* (ADR 0001: no LLM key in the app), the wrong shape for a fixed
  hand-authorable chrome-string set.

Its live contributions carried into the map: the **mixed-language UX marker** note (still map-level
fog) and the observation that chrome `dir` and the sandboxed lesson iframe's `dir` (ADR 0011) are
set independently. Verified 2026-07-10 (main @ 1b2db94) as still outstanding at import time: no i18n
framework in `package.json`, no message catalogs, chrome strings hard-coded English
(`CourseShell.tsx:175-202`); the existing pickers switch Edition content only, not the UI locale.
