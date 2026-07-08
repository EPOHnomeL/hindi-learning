# Translation via Gemini 3.5 Flash

Status: ready-for-agent

> The translate side of the OpenRouter provider line. Follows the course's
> provider. See [`../PRD.md`](../PRD.md) and
> [`convex/translate.ts`](../../../convex/translate.ts).

## What to build

Let an owner translate a **completed OpenRouter course** into a language using
**Gemini 3.5 Flash**, reusing the existing Editions machinery. Translation
**follows the course's provider**: a Claude course keeps translating through the
existing claude.ai translate Routine, untouched.

- The translate fire branches on provider (mirroring the authoring branch in
  issue 01): `claude` → POST the translate routine fire URL; `openrouter` →
  schedule an internal translate action for the (topic, language) job. No
  `claimTranslation` needed on the OpenRouter path.
- The translate action reads each source item, translates it single-pass on
  Gemini 3.5 Flash via the OpenRouter client, and publishes through the existing
  `publishTranslation` (which stamps the source hash and rejects quiz-structure
  drift), ticking the job. It reports `ready`/`failed` via the existing
  `reportTranslation`.
- The Editions panel, per-item status/progress, English fallback, and Edition
  removal all work unchanged.

## Acceptance criteria

- [ ] Translating a completed OpenRouter course into a supported language produces a `ready` Edition whose items render in the reader.
- [ ] Translation on a `claude` course still fires the claude.ai translate routine (unchanged).
- [ ] The gate/lock (`tryAcquireTranslation`) and `reportTranslation` are reused; the OpenRouter path schedules the action instead of POSTing.
- [ ] `publishTranslation`'s quiz-structure guard and source-hash stamping still apply; an unpublished/failed item falls back to English.
- [ ] The Editions panel shows live status, and Edition removal cleans up as before.
- [ ] Tests cover the translate fire branch (schedule vs POST) and publish wiring against a mocked client.
- [ ] Behavior verified live on a dev deployment with `OPENROUTER_API_KEY` set.

## Blocked by

- [02 — OpenRouter client + bundled authoring assets](./02-openrouter-client-and-bundled-authoring-assets.md)
