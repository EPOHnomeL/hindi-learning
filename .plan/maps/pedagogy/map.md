# Pedagogy

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

An honest organising frame for teaching across modalities — decided as **structure or
policy** — with every band of the pyramid having a named owner, including the top one the
learner never reaches today, and the **conversational and group modalities** that frame calls
for scoped alongside it rather than in maps of their own.

## Notes

<!-- Tickets 04–06 arrived 2026-08-01 from three retired single-ticket maps (ai-chat,
     knowledge-grilling, live-quiz). Each carries its old map's context folded into the
     ticket under a "Context folded from" heading. -->

- **Why chat, grilling and the live quiz live here.** Ticket 01's whole deliverable is naming
  an owner for every modality; three of those owners were sitting in separate one-ticket maps.
  Discussion and coaching ride
  [the chat substrate](tickets/04-interactive-ai-chat-substrate.md);
  [knowledge grilling](tickets/05-diagnostic-mode-and-teach-me-that-handoff.md) is the
  diagnostic that decides *what* to teach next; the
  [live group quiz](tickets/06-scope-live-group-quiz.md) is retrieval practice with an
  audience. Deciding them apart from the frame is how the frame ends up fictional.
- **04 is the substrate 05 rides on.** Both need an always-on responder; 04 owns the
  serving-path and metering decision, and **05's withholding rule is the constraint that
  substrate has to satisfy** — a chat UI that helps turn-by-turn destroys the diagnosis.
  Settle the seam early rather than building a second chat path.
- **06 is the cheap one and the odd one:** zero-AI if the assumption holds, mostly Convex
  reactivity, and honestly a *marketing and demo* feature wearing a pedagogy costume.

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
- **The seams, stated so they stay stated:** coaching is *conversation* (ticket 04's
  substrate), assignment is *structure* (ticket 02). Audio-visual belongs to
  [rich-media](../rich-media/map.md). Ticket 01 must reconcile with
  [Course modules](../course-management/tickets/04-modules-and-per-module-unlocking.md) — "are
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
- **Grounding mechanics** for the chat substrate (context-stuffing vs RAG) — named in ticket
  04; graduates once the serving path is fixed.
- **Whether the Routine reads chat history for ZPD signal** — a real change to the teaching
  loop's inputs, sharper once persistence is decided.
- **What a gap map *is* in the data model** (ticket 05) — a capture kind, a first-class
  entity, or a transient handed to the Routine. Sharpens once the substrate is fixed.
- **The post-session marketing capture** on a live quiz — who played, contact opt-in, the
  call-to-action at the end. Sharpens once the session model exists.

## Out of scope

- Cohorts and any multi-learner or community features (explicitly out of v1 in both 02 and 03).
  The live quiz (ticket 06) is the deliberate exception: one host, one room, one session — not
  a persistent cohort.
- Building the phase machinery, or the discussion/audio/practice features themselves.
- Multi-user 1-on-1 chat rooms — resolved 2026-07-15, the chat is 1-on-1.
- Replacing quizzes or Responses as the ambient progress signal — grilling is an additional
  diagnostic, not a substitute.
