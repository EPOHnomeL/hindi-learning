# translation-engine-picker/01: store engine on the translation job

**Status:** open
**Labels:** ready-for-agent

PRD: .scratch/translation-engine-picker/PRD.md

Add an optional `engine: "free" | "gemini"` to the `translationJobs` schema
(`convex/schema.ts`). Reads treat an absent value as `"gemini"` (today's
behaviour) — no migration.

Thread it through the lock path in `convex/translate.ts`:

- `tryAcquireTranslation` gains an optional `engine` arg. Resolve the effective
  engine: use the arg when given; otherwise reuse the existing job's stored
  engine (default `"gemini"`). Persist it on the job patch/insert.
- Compute a **forced** flag: `true` when the requested engine differs from the
  job's previously stored engine. When forced, seed `done: 0` (a full redo);
  otherwise keep the resume seeding (count fresh items).
- Return the resolved `engine` + `forced` in the `acquired: true` result so the
  caller (`startTranslation`) knows which path to fire.
- `editions` query returns each edition's `engine` (validator + mapping); the
  source English row reports `"gemini"` or a sensible constant (it never
  translates).

Tests (TDD, `convex/translate.test.ts`): default engine is `gemini`; acquiring
with a different engine flips the stored engine and forces `done: 0`; acquiring
with the same engine keeps resume seeding; `editions` surfaces `engine`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
