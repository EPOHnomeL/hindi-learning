# edition-title-edit/01: editEditionText mutation

**Status:** done
**Imported:** from GitHub #41 on 2026-07-15 (created 2026-07-13, closed 2026-07-13; GitHub issue deleted after import)

PRD: .scratch/edition-title-edit/PRD.md

One mutation editEditionText({topicSlug, lang, kind: "title"|"mission", text}) in translate.ts: rejects lang=en, gated by getEditableTopic (owner or that Edition's Editor), upserts the (topicId, lang, kind, "") translations row with sourceHash stamped so re-translate keeps the edit; blank text deletes the row (revert to auto). Seam tests per the PRD.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
