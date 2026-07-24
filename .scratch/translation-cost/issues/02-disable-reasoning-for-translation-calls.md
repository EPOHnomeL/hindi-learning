# translation-cost/02: disable reasoning for translation calls

**Status:** done
**Depends on:** —
**Imported:** from GitHub #39 on 2026-07-15 (created 2026-07-13, closed 2026-07-13; GitHub issue deleted after import)

## Why

PRD: `.scratch/translation-cost/PRD.md`

Gemini 3.5 Flash currently burns default thinking tokens billed as output on every translation call.

## Scope

`chatComplete` gains a reasoning opt-out (OpenRouter unified reasoning-disable param — verify exact field against docs); `translateField` always passes it. Authoring (GLM 4.7) untouched.

## Notes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
