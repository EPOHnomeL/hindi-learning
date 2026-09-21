---
type: task
blocked_by: [02, 03, 04, 05, 06]
---
# The score cannot silently regress

## Question

A Lighthouse score is a snapshot, and the failure mode for this whole effort is not that
02 to 06 fail to work. It is that they work, and then eighteen months of ordinary feature
work walks the number back down, and nobody notices until someone runs an audit again.
This repo has been bitten by that shape of decay already: the 2026-09-09 performance scan
opens by saying the easy wins were already taken, and three of that map's own tickets had
gone stale against the tree by 2026-09-21.

So the last ticket is the guard: take whatever 02 to 06 actually achieved and make it the
floor.

What to get right rather than guess:

- **The floor is the achieved number, not an aspiration.** Read it out of the reports 02
  to 06 produced. A budget set above what the tree does is a permanently red check that
  everyone learns to ignore, which is worse than no check at all.
- **Noise is the whole engineering problem here.** Ticket 01 was asked to record how much
  the scores move across repeated runs of the same URL. That figure sets the tolerance,
  and if the spread is wide, a hard per-run gate is the wrong instrument. The map's
  `## Not yet specified` patch names this as genuinely undecided, and this ticket is
  where it gets decided; whatever is chosen, say why in the Answer.
- **Where it runs.** The score of record comes from a Vercel preview URL (charter ruling,
  2026-09-21), so the check needs a deployed URL to exist before it can run. That
  constrains the options: a pre-merge gate has to wait on the preview deploy.
- **What it costs a contributor when it fires.** A failure has to name the URL, the
  category and the audit, or the next person just re-runs it and moves on. The report
  artefact matters as much as the pass or fail.
- **Budgets beyond the categories.** Lighthouse takes a `budget.json` for resource counts
  and byte weights. Ticket 02's First Load JS win is the one most likely to be eroded by
  an ordinary import, and a byte budget catches that earlier and more legibly than a
  Performance score does.

## Done when

- A committed budget records the scores and, where useful, the byte weights that 02 to 06
  achieved, with each number traceable to the report it came from.
- A change that regresses the landing page fails the check, demonstrated deliberately
  once on a throwaway branch and described in the Answer. Not asserted from the config.
- The failure output names the URL, the category and the failing audit.
- The Answer states what instrument was chosen (hard gate, advisory, or scheduled), the
  run-to-run tolerance it allows, and why, referring to the noise figure from 01.
- The map's `## Not yet specified` patch about what the floor should cost a contributor is
  removed in the same commit, since this ticket is its answer.
