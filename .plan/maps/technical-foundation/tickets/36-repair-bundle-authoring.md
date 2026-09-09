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

## Answer

2026-09-08, built. `pnpm bundle:authoring` exits 0 again.

The authoring contract lives at `lessons/AUTHORING.md`, beside the template and partials it
describes, in a directory this repo owns rather than one `npx skills update` can delete.
**The other five teach docs stay pointed at the skill on purpose**, which is this ticket's
"check the other five" answered: copying them here would manufacture the drift the bundler
exists to prevent, so instead the bundler refuses loudly if the CLI takes another one.

The bundle is reachable as one function, `bundleAuthoringAssets`, so the suite runs the real
thing. That is the actual fix: the old test exercised `renderAssetsModule` against fixtures
and stayed green for eleven days while the bundler could not start. One assertion now covers
both failure modes, a missing source and a stale generated file, and a second test proves the
missing-source path throws with the source named rather than a bare absolute-path ENOENT.

Regenerating folded in twelve days of skill drift, frozen since 2026-08-27.

This unblocked 37, which had to edit `lessons/_partials/head.html`.

Verified by test, including one proved able to fail. `pnpm typecheck` and the full suite
green.
