# translation-cost/01: strip static blocks from translated bodies

**Status:** done
**Imported:** from GitHub #38 on 2026-07-15 (created 2026-07-13, closed 2026-07-13; GitHub issue deleted after import)

PRD: .scratch/translation-cost/PRD.md

Placeholder-swap every <style>/<script> element out of Lesson/Reference bodies before the Gemini call and substitute them back after, with strict verification (each placeholder exactly once, none invented) — a mismatch skips the item (English fallback, counted failed). Also check quiz-marker counts (quizStructureMatches) in the action, since the mutation-side guard is skipped for blob-backed sources. ~70% of lesson body tokens are this fixed boilerplate, paid on input AND output.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
