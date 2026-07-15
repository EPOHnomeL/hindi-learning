# ai-chat — scoping tickets

From the 2026-07-15 grilling of the feature notes: four separate AI-conversation products
(the user's call — not modes of one surface), all riding one substrate. Today the *only*
learner↔AI conversation is asynchronous ([[Question]] → Routine [[Reply]]); everything here
adds a **live** plane, which means a new serving path (always-on LLM responder, cost
metering, grounding) — that's ticket 01's problem, once.

| # | Ticket | What it is |
|---|--------|-----------|
| 01 | [Course Chat](issues/01-scope-course-chat.md) | The substrate: persistent, course-wide, 1-on-1 chat with the AI |
| 02 | [Debate mode](issues/02-scope-debate-mode.md) | Free sparring — the AI takes stances and challenges/defends the content |
| 03 | [Guided discussion](issues/03-scope-guided-discussion.md) | Structured format, good-cop/bad-cop dual personas |
| 04 | [Apply-outcomes coaching](issues/04-scope-apply-outcomes-coaching.md) | Maps lesson outcomes onto the learner's Mission / real life |

02–04 all depend on 01. Seams: pedagogy/02 (experiential assignments vs 04's conversation),
whitelabel/04 (chat as a tenant flag), ADR 0014 (which provider line serves chat).
