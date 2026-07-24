# course-translation/02: The course mission is translated + billed on every Edition but never read

**Status:** open — no product decision taken; the Mission is still translated but every surface still renders English
**Depends on:** — (none, can start immediately)
**Imported:** from GitHub #19 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/course-translation/issues/02-course-mission-translated-but-unread.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/course-translation/issues/02-course-mission-translated-but-unread.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

> Deferred follow-up from the PR #4 review (product decision needed).

Resolve the mismatch where a course's **mission** is enumerated as a translatable
item — so it's translated and billed a Claude call for every language, and
counted into the job's `total`/`done` — yet **no read seam ever serves the
translated mission**. The "Shared with me" feed and the dashboard both render the
raw English `topic.mission`, so a non-English Viewer sees the English mission and
every added language spends a wasted call.

## Scope

Pick one direction (this is a product call):

- **Drop it from translation** — stop enumerating the mission item, so no
  language pays for a rendering nobody reads. Non-English surfaces keep showing
  the English mission (unchanged from today), for less cost.
- **Wire it through** — serve the translated mission wherever the mission is
  shown to a holder of that Edition (shared-course card, mission dialog), so the
  billed translation is actually used.

## Acceptance criteria

- [ ] Decision recorded (drop vs. wire-through) with a one-line rationale.
- [ ] If dropped: the mission item is no longer enumerated/translated, and job
      `total` no longer counts it; existing tests still pass.
- [ ] If wired: a Viewer holding only a non-English Edition sees the mission in
      that language on every surface that shows it, with English fallback when a
      mission translation is missing.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: the Mission is enumerated into every translation job (translate.ts:53) and billed per Edition, but no read path serves the translated Mission — every surface returns raw English `topic.mission` (content.ts:93,134; shares.ts:295). Tellingly, the shared-feed query resolves the *title* per-Edition (shares.ts:282-289) but never the mission. The product decision (stop translating vs start reading) is still untaken.
