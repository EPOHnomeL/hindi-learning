# translation-cost/01: strip static blocks from translated bodies

**Status:** done
**Depends on:** —
**Imported:** from GitHub #38 on 2026-07-15 (created 2026-07-13, closed 2026-07-13; GitHub issue deleted after import)

## Why

PRD: `.scratch/translation-cost/PRD.md`

~70% of lesson body tokens are fixed `<style>`/`<script>` boilerplate, paid on
input AND output on every translation call.

## Scope

Placeholder-swap every `<style>`/`<script>` element out of Lesson/Reference bodies before the Gemini call and substitute them back after, with strict verification (each placeholder exactly once, none invented) — a mismatch skips the item (English fallback, counted failed). Also check quiz-marker counts (`quizStructureMatches`) in the action, since the mutation-side guard is skipped for blob-backed sources.

## Notes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
