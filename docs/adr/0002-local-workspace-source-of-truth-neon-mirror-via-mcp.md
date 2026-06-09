# Local teach workspace is the source of truth; Neon is a published mirror + inbox, integrated via the Neon MCP

Content is authored by Claude Code's file-based teach skill (a workspace of `lessons/*.html`, `reference/*.html`, `MISSION.md`, `learning-records/`, `GLOSSARY.md`). That local workspace is the **source of truth**. An explicit **Publish** action pushes artifacts to the hub: HTML blobs go to R2 (see ADR-0005) and the metadata rows go to Neon via the Neon MCP (insert new Lessons, upsert References). Neon additionally accumulates learner-generated data (Responses, Questions) created only on the web, which Claude Code reads back through the same MCP to drive the next authoring round.

## Considered Options

- **Hub as source of truth** — rewire the teach skill to read/write Lessons as Neon rows directly. Rejected: the skill is deeply file-oriented (numbered HTML files, `reference/` dir, "open the lesson with one CLI command"); a DB-native model fights that grain and means reimplementing the skill.
- **Chosen: local files as source of truth, Neon as published mirror + inbox.** Leaves the teach skill working as designed; adds only a thin publish-out / read-back seam.

## Consequences

- The teach skill is used unmodified; authoring works offline.
- Publish is a deliberate command, not a live sync — the hub can lag the workspace until you publish.
- There are two write paths, but they split cleanly by concern: file-based blob upload (wrangler → R2) and small structured rows (Neon MCP). This is why the earlier "stuff HTML into Postgres via MCP SQL" friction was abandoned — see ADR-0005.
- Responses/Questions live only in the hub and never round-trip into the workspace as files; Claude Code consumes them via MCP reads and folds insight into local learning-records.
