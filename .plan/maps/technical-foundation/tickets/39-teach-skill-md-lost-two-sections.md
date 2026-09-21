---
type: task
blocked_by: []
---
# The teach `SKILL.md` lost two sections the contract still cites

## Question

`docs/routine-prompt.md` is the unattended teaching Routine's whole contract, and until
today two of its rules pointed at sections of `.agents/skills/teach/SKILL.md` that **do
not exist**:

- step 6 cited `SKILL.md "Terminating a Course"` for the terminate-vs-pause judgement;
- step 8 cited `SKILL.md "The Lesson-Count Estimate"` for the soft-forecast rule.

Verified 2026-09-21 on `main` @ `d8389f7`: `SKILL.md` has thirteen headings and neither
is among them, and `convex/authoringAssets.generated.ts` (the bundled copy the
OpenRouter authoring action is actually given, ADR 0014) does not contain either
string either. So the model authoring lessons through that path has never been told
these rules by the skill; it only ever got them from the Routine prompt's own inline
wording, which does state both correctly.

Two decision records assert the sections exist and lean on them:

- [ADR 0015](../../../../docs/adr/0015-course-completion-and-certificates.md) consequences:
  "The teach skill's instructions gain a 'Terminating a course' section (judge against
  'Success looks like'; call `completeCourse`; …)".
- [ADR 0018](../../../../docs/adr/0018-lesson-count-estimate-advisory.md): "The guarantee
  lives in the agent contract (`docs/routine-prompt.md`, teach `SKILL.md`) and in this
  record."

The likely cause is the same one ticket [36](./36-repair-bundle-authoring.md) diagnosed
and only half-closed: `e242e50` (2026-08-27), a routine `skills update`, rewrote the
CLI-managed `.agents/skills/teach/` directory. 36 moved `AUTHORING.md` out of that
directory for exactly this reason and consciously **left the other five docs pointed at
the skill**, on the reasoning that the bundler "refuses loudly if the CLI takes another
one". It does refuse loudly when a *file* disappears. It is silent when the CLI rewrites
a file that is still present and drops sections out of it, which is what appears to have
happened here. (Not provable from this clone: it is shallow, so the pre-`e242e50`
`SKILL.md` is not fetchable. Confirm from a full clone before treating the cause as
settled. The *gap itself* is verified regardless of how it got there.)

Filed out of the 2026-09-21 teaching run for `tech-shortcuts`, which lost time to both
dangling pointers plus the stale `AUTHORING.md` path 36 left behind in the Routine
prompt. That prompt's three references are fixed in the same commit as this ticket; this
ticket is the half that needs a decision rather than a correction.

Note `.scratch/lesson-estimate/issues/02-…` already flagged the estimate pointer as
dangling on 2026-07-10. `.scratch/` is retired (2026-07-30, CLAUDE.md), so that finding
never made it into a map and sat unread for ten weeks. This ticket is its one home now;
it also covers the "Terminating a Course" pointer, which nothing had recorded.

## Done when

Someone has decided **whether `SKILL.md` should carry these two sections at all**, and
the tree matches the decision:

- If yes: the sections are restored into a copy of the teach docs this repo owns (36's
  move of `AUTHORING.md` is the precedent), `TEACH_DOCS` in
  `scripts/bundle-authoring-assets.ts` points there, the bundle is regenerated, and the
  Routine prompt's step 6 and step 8 may point back at `SKILL.md` instead of the ADRs.
- If no, meaning the Routine prompt is the contract and the skill is only the
  teaching-judgement half: ADR 0015 and ADR 0018 get a superseding or amending record saying so, since both
  currently assert a `SKILL.md` section that is not going to exist. (Per CLAUDE.md, an
  ADR is never rewritten to correct it.)

Either way, add the check 36 stopped short of: the bundler should fail on a teach doc
that is present but has lost a **section** the contract names, not only on one that has
been deleted. Without it the next `skills update` does this again, silently.

<!-- Filed 2026-09-21 by the tech-shortcuts teaching run (lesson 8). -->
