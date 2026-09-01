---
type: task
blocked_by: [06]
---
# Stand up the Routine, and write for the agent that runs it

## Question

The report is a full agent Routine, the third sibling of `teacher-next-lesson` and
`translate`. The user has already created it on claude.ai as **"Ywam Potch Translator
Status"**, wired to `EPOHnomeL/hindi-learning` and `hindi-learning-prod`, triggering
**weekly on Sunday at 07:00 GMT+2**, with `PUBLISH_SECRET` and `CONVEX_PROD_URL` on its
environment. Its Instructions field currently holds the user's raw one-paragraph ask.

Produce the three documents the other two Routines each have, and replace that field.

- **`docs/translator-status-routine-prompt.md`** — the canonical Instructions, in the
  same shape as [`routine-prompt.md`](../../../docs/routine-prompt.md) and
  [`translation-routine-prompt.md`](../../../docs/translation-routine-prompt.md): a
  fenced block to paste, and the standing declaration that the repo copy wins on drift.
  There is **no claim step** here (one tenant, hardcoded, no queue), which is the one
  structural difference from its siblings, and it should say so rather than leave a
  reader hunting for the missing step.
- **`docs/translator-status.md`** — the operational runbook, for the human: the trigger
  and its cadence stated out loud (the schedule lives in a claude.ai field, not in
  git, so the repo has to say what it is), the env, the data path, what the run does
  not do, and the fact that the Convex connector on the routine is an escape hatch for
  questions 04's query does not answer rather than the primary read path.
- **A skill under `.agents/skills/`** — what the run reads to know how to work, the way
  the teacher reads `teach/SKILL.md` and the translator reads `translate/SKILL.md`.

Then run **`mattpocock-skills:writing-for-agents`** over the two agent-facing documents
(the Instructions and the skill; the runbook is for the human and reads differently).
The levers that matter most here: a clear completion criterion per step, no negation
where a positive target will do, no restatement of what the environment already says,
and progressive disclosure so the Instructions field stays short and the skill carries
the mechanics.

## Done when

- All three documents exist, and the Instructions field on claude.ai has been replaced
  with the fenced block from the repo copy.
- The runbook states the Sunday 07:00 GMT+2 cadence explicitly.
- `writing-for-agents` has been applied to the Instructions and the skill, and the
  Answer says what it changed.
- One real run has fired end to end and produced an artifact, with its URL in the
  Answer. A document that has never been run is not done.

## Ruled out

**Superseded on 2026-09-01 by the course Dashboard tab.** The report is not a Routine.
A live tab has no cadence, so there is no Sunday 07:00 GMT+2 run, no third sibling of
`teacher-next-lesson` and `translate`, no Instructions field, and no runbook.

**One live loose end, for the operator, not for an agent:** the Routine
**"Ywam Potch Translator Status"** already exists on claude.ai, wired to
`EPOHnomeL/hindi-learning` and `hindi-learning-prod` with `PUBLISH_SECRET` and
`CONVEX_PROD_URL` on it. It was never given instructions, so it is inert rather than
wrong, but it should be deleted so a later session does not find it and assume this
map is live. Nothing in this repo can delete it.
