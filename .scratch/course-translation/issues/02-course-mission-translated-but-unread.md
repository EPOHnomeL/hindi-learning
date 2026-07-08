# The course mission is translated + billed on every Edition but never read

Status: open — no product decision taken; the Mission is still translated but every surface still renders English

> Deferred follow-up from the PR #4 review (product decision needed).

## What to build

Resolve the mismatch where a course's **mission** is enumerated as a translatable
item — so it's translated and billed a Claude call for every language, and
counted into the job's `total`/`done` — yet **no read seam ever serves the
translated mission**. The "Shared with me" feed and the dashboard both render the
raw English `topic.mission`, so a non-English Viewer sees the English mission and
every added language spends a wasted call.

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

## Blocked by

- None — can start immediately.
