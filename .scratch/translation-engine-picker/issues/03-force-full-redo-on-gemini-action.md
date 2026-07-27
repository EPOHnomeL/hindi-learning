# translation-engine-picker/03: force full redo through the Gemini action

**Status:** open
**Depends on:** 01, 02
**Labels:** ready-for-agent

PRD: .scratch/translation-engine-picker/PRD.md

Make a forced Gemini run re-translate every item instead of skipping fresh ones
(`convex/translate.ts`):

- `translateTopic` gains an optional `force` arg, passed by `startTranslation`
  from the `forced` flag and preserved across its self-reschedule
  (continuations keep `force`).
- `collectForTranslation` gains a `force` arg; when `force`, skip the `isFresh`
  short-circuit so all items are returned. Resume-within-run is unchanged — the
  `remaining` work-list still pins each continuation's items.
- Never delete existing rows up front; `publishTranslation` replaces them
  item-by-item (reader keeps the old translation until the new one lands).

Only the Gemini path needs this — the free routine always does a full pass
(it has no `isFresh` skip). So `gemini→gemini` re-translate = resume (force
false), and `free→gemini` (or any engine change into gemini) = force true.

Tests (`convex/translate.test.ts`): a forced `collectForTranslation` returns
items that are already fresh; an unforced one still skips them; end-to-end, a
forced `translateTopic` re-publishes an item whose `sourceHash` already matched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
