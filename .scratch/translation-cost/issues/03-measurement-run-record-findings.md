# translation-cost/03: measurement run + record findings

**Status:** open
**Depends on:** issues 01 and 02 (deploy first)
**Imported:** from GitHub #40 on 2026-07-15 (created 2026-07-13; GitHub issue deleted after import)

## Why

PRD: `.scratch/translation-cost/PRD.md`

Baseline: $6.82 / 1.26M tokens / 118 requests for 59 items.

## Scope

After 01+02 deploy: translate the Test Course into a new language (smoke, ~cents), then the Growing course into one genuinely wanted language — read $ + token volume off the OpenRouter dashboard and record them in the PRD. Then decide whether a cheaper model (`OPENROUTER_TRANSLATE_MODEL` env var) is still wanted.

## Notes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
