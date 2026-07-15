# ai-chat/01: Scope Course Chat (persistent 1-on-1 AI chat, the substrate)

**Status:** open
**Depends on:** —

## Why

Every learner↔AI conversation today is asynchronous: a [[Question]] waits for the Routine's
[[Reply]] (ADR 0001 keeps the LLM out of the web app). The user wants a **persistent,
course-wide, 1-on-1 chat** with the AI ("chatroom" note, resolved 2026-07-15: not
multi-user). That's a new interaction plane and a new serving path — an always-on responder
— which tickets 02–04 (debate, guided discussion, apply-coaching) all ride on. Scope the
substrate once, here.

## Questions to answer

- **Serving path**: a Convex action calling the provider gateway
  ([`openrouterClient.ts`](../../../convex/openrouterClient.ts) exists), the
  `@convex-dev/agent` component (threads/messages/tools out of the box), or something else?
  How does this square with ADR 0001 (no LLM in the web app) — amend it, or is an action
  "not the web app"?
- **Provider & cost** (ADR 0014): which line serves chat — Managed (operator's key, metered)
  and/or BYOK? Per-learner token caps / rate limits — a chatty learner must not be able to
  run up an unbounded bill. What's the metering story?
- **Grounding**: the chat must answer from the course's own content (never parametric
  knowledge — teach-skill rule). Context-stuff lessons/references, or RAG over them? What
  about Resources (ties to rich-media manifests)?
- **Relationship to Questions**: does Course Chat absorb the async Q&A, or coexist (chat for
  now-answers, Question for teacher-grade answers)? Can a chat exchange escalate into a
  [[Question]] for the Routine? The Routine should probably *read* chat history for ZPD
  signal — does it?
- **Persistence**: thread/message tables per (user, topic); what do Viewers get (own thread?
  none)? Guests: surely none — confirm.
- Naming: propose the CONTEXT.md term (**Course Chat**? **Discussion**?) — must not collide
  with Question/Reply/Response.
- Tenant flag (whitelabel/04) and marketplace implications (chat on purchased courses = COGS).

## Out of scope

- The three conversation formats riding on this (tickets 02–04).
- Multi-user rooms (explicitly resolved: not this).

## Deliverable

Serving-path + provider/metering decision (likely an ADR — it bends ADR 0001), the grounding
approach, the Question-coexistence rule, and the proposed CONTEXT.md term.
