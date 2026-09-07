---
type: task
blocked_by: []
---
# `pnpm bundle:authoring` has been broken since 2026-08-27

## Question

`pnpm bundle:authoring` regenerates `convex/authoringAssets.generated.ts` — the module
that carries the `teach` skill's instructions and the lesson HTML partials into the
filesystem-less OpenRouter authoring action (ADR 0014). It is the no-drift guarantee
between the skill and what the model is actually told.

**It throws.** Verified 2026-09-07:

```
ENOENT: open '.agents/skills/teach/AUTHORING.md'
```

`TEACH_DOCS` in `scripts/bundle-authoring-assets.ts:16` lists six files;
`.agents/skills/teach/` now contains five. `AUTHORING.md` was deleted by **`e242e50`
(2026-08-27), "chore(skills): update all installed skills to latest via skills CLI"** —
a routine tool-managed refresh of a directory the skills CLI owns, which happened to
own a file this repo's build depends on.

**Nothing caught it for eleven days.** `scripts/bundle-authoring-assets.test.ts` tests
`renderAssetsModule`, the pure renderer, against fixture strings. It never runs the
bundler, so it stays green while the bundler cannot start. The generated file is
therefore frozen at its 2026-08-27 content and silently diverges from the skill every
time the skill changes — the exact failure the script's own header comment says it
exists to prevent.

## What to build

Three parts, and the first is the actual decision:

1. **Move the authoring contract out of the skills-CLI-managed directory.** As long as
   the file lives under `.agents/skills/teach/`, the next `skills update` can delete it
   again. Recover the deleted content (`git show e242e50^:.agents/skills/teach/AUTHORING.md`),
   put it somewhere this repo owns, and leave a pointer where the skill expects it.
2. **Repoint `TEACH_DOCS`** at the new location. Check the other five while you are
   there: they live in the same CLI-managed directory and have the same exposure.
3. **Add a check that actually runs the bundler.** Regenerate and assert the output
   matches the committed file — the script is deterministic and write-only-on-change by
   design, so this is a cheap assertion and it fails loudly on both a missing source and
   a stale generated file.

## Done when

`pnpm bundle:authoring` exits 0, `convex/authoringAssets.generated.ts` is regenerated
from sources this repo owns, and a check that runs the bundler fails when a source file
goes missing (proved by making it fail).

<!-- Filed 2026-09-07 out of the answer to 02: it blocks 37, which has to edit
     lessons/_partials/head.html and cannot ship that edit while the bundler is dead. -->
