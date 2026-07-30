# Interactive AI chat

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A locked **serving-path and metering decision** for a persistent, course-wide, 1-on-1 learner
chat — the new interaction plane that debate, guided discussion, and apply-outcomes coaching
all ride on. This map produces the substrate decision (likely an ADR) and a CONTEXT.md term,
not the chat.

## Notes

- **Domain:** Question, Reply, Response, Routine (CONTEXT.md). The proposed new term is the
  ticket's job — it must not collide with Question/Reply/Response.
- **It bends ADR 0001** (no LLM in the web app). Whether a Convex action counts as "not the
  web app" is a real decision, not a technicality.
- **Cost is first-class**, per the user's own framing ("can become costly") — a chatty
  learner must not be able to run up an unbounded bill. Ties to
  [paid-marketplace/01](../paid-marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md)
  and ADR 0014's two lines.
- The three conversation *formats* were scoped separately and closed on GitHub as
  ai-chat/02 (debate), /03 (guided discussion), /04 (apply-outcomes coaching). Their scope
  is folded into ticket 01's body — grill against it, don't re-chart it.
- Seams: [pedagogy/01](../pedagogy/tickets/01-scope-learning-pyramid-phases.md) (discussion
  is a pyramid modality), [pedagogy/02](../pedagogy/tickets/02-scope-experiential-learning.md)
  (coaching = conversation, assignment = structure),
  [knowledge-grilling/01](../knowledge-grilling/tickets/01-diagnostic-mode-and-teach-me-that-handoff.md)
  (also wants an always-on responder — likely the same substrate).
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `convex:agent` if the
  `@convex-dev/agent` component is on the table.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Grounding mechanics.** Context-stuffing vs RAG is named in ticket 01 as a question; the
  answer probably graduates into its own ticket once the serving path is fixed.
- **Whether the Routine reads chat history for ZPD signal** — a real change to the teaching
  loop's inputs, sharper once persistence is decided.

## Out of scope

- **Multi-user rooms.** Explicitly resolved 2026-07-15: this is 1-on-1.
