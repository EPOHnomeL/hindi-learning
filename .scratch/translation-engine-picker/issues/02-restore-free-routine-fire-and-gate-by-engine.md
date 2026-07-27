# translation-engine-picker/02: restore free-routine Fire POST, gate startTranslation by engine

**Status:** open
**Depends on:** 01
**Labels:** ready-for-agent

PRD: .scratch/translation-engine-picker/PRD.md

Restore the free-routine fire path removed in `3620d0e` and branch
`startTranslation` on the resolved engine (`convex/translate.ts`):

- Re-add a `postTranslateFire()` helper that POSTs `TRANSLATE_FIRE_URL` /
  `TRANSLATE_FIRE_TOKEN` (mirror `routine.ts` `postRoutineFire`; closed body
  `{}`; throws on missing env or non-2xx).
- `startTranslation` accepts an optional `engine` arg, passes it to
  `tryAcquireTranslation`, then on the resolved engine:
  - `free` ⇒ `postTranslateFire()`. On a missing-env / failed POST, release the
    lock via `failTranslation` and surface a clear error
    ("free translation not configured" when env is unset).
  - `gemini` ⇒ `scheduler.runAfter(0, translateTopic, …)` as today, passing the
    `forced` flag through.
- `claimTranslation` filters candidates to `engine === "free"` jobs only
  (absent engine = `gemini`, so never claimed by the cloud routine).

Tests: `free` engine calls the fire POST and does NOT schedule the action;
`gemini` schedules the action; free with unset env releases the lock + errors;
`claimTranslation` skips a `gemini` (and an absent-engine) job and only returns a
`free` one. Update `convex/translate-openrouter.test.ts` expectations if the
fire-error message/shape changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
