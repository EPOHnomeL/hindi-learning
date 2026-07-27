# translation-engine-picker/04: Editions panel engine picker + re-translate UI

**Status:** open
**Depends on:** 01, 02, 03
**Labels:** ready-for-agent

PRD: .scratch/translation-engine-picker/PRD.md

Expose the engine choice in `src/app/_components/Editions.tsx` (strings via
`next-intl`, add keys to `messages/*.json` under `Editions`):

- **AddLanguagePanel**: a Free / Gemini engine picker, **defaulting to `free`**.
  Gemini's label warns it uses tokens. Pass the chosen `engine` to
  `startTranslation`.
- **EditionPanel (ready)**: an always-visible engine toggle (Free | Gemini)
  seeded from `edition.engine`, plus a **Re-translate** button that calls
  `startTranslation({ topicSlug, lang, engine })` with the toggled engine.
- **RetryTranslation (failed)**: unchanged call shape — omit `engine` so the
  server reuses the job's stored engine.

`api.translate.editions` now returns `engine` per edition (from ticket 01) — use
it to seed the toggle and show which engine produced the edition.

Add the new i18n keys to every locale in `messages/` (en, af, es, fr, hi) so
`messages/parity.test.ts` passes.

Verify: adding a language defaults to Free; switching a free ready edition to
Gemini and hitting Re-translate redoes the edition; retry on a failed edition
does not change its engine.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
