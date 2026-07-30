# Pedagogy

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

An honest organising frame for teaching across modalities — decided as **structure or
policy** — with every band of the pyramid having a named owner, including the top one the
learner never reaches today.

## Notes

- **Say the honest thing about the evidence, in every ticket:** the learning pyramid's
  retention percentages are folklore. Frame this work on the *modalities*, and on what is
  actually evidence-backed — retrieval practice, spacing, interleaving, the protégé effect and
  self-explanation. Ticket 03 exists on that evidence, not on "90%".
- **Ticket 01 is the fork the other two hang off:** structural (the platform tracks phases per
  concept — schema, reader UI, a richer Frontier) vs policy (the teach skill must author across
  modalities; the platform stays as-is, ponytail-cheap, ships first) vs a staged middle road.
- **Ticket 03 is deliberately the policy half already** — `SKILL.md` authoring rules only,
  zero schema, zero platform machinery. It is takeable *now*, without waiting on 01, and it
  gives "teach others" the owner 01 says is missing. Note `.agents/skills/teach/SKILL.md` is
  canonical; `.claude/skills/teach` symlinks into it — one edit, not two.
- **The seams, stated so they stay stated:** coaching is *conversation*
  ([ai-chat/01](../ai-chat/tickets/01-interactive-ai-chat-substrate.md)'s substrate),
  assignment is *structure* (ticket 02). Audio-visual belongs to
  [rich-media](../rich-media/map.md). Ticket 01 must reconcile with
  [course-modules/01](../course-modules/tickets/01-modules-and-per-module-unlocking.md) — "are
  phases within modules?" is the same question from two sides.
- **Verification honesty (ticket 02):** the platform cannot verify real-world action. Design
  for self-report and do not pretend otherwise — no fake "verified" badges.
- **"Demonstration" has no owner** in the mapping table today. Ticket 01's deliverable is
  naming the gaps, not quietly leaving them.
- Skills: `/grilling` + `/domain-modeling` (three CONTEXT.md terms are proposed across these
  tickets), `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether Completion changes meaning** if a concept has phases (complete = all phases done).
  Raised in ticket 01; graduates only if the structural branch wins.
- **Remediation policy** when a learner's practice or reflection goes badly. The same policy
  seam appears in [rich-media](../rich-media/map.md) — whoever reaches it first should own it.

## Out of scope

- Cohorts and any multi-learner or community features (explicitly out of v1 in both 02 and 03).
- Building the phase machinery, or the discussion/audio/practice features themselves.
