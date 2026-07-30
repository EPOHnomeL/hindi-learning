---
type: grilling
blocked_by: []
---

# Interactive AI chat feature (substrate + debate + guided discussion + apply-outcomes coaching)

## Question

Merged from 4 separate scope tickets (formerly [ai-chat/01](01-interactive-ai-chat-substrate.md)–#57) — they're one dependency chain
(01 substrate, 02–04 all depend on it), not four independent features. User's framing when
requesting this: **"an interactive chat feature that actually works for users to use
(to-scope: can become costly)"** — cost/metering is a first-class open question below,
not an afterthought.

## Why

Every learner↔AI conversation today is asynchronous: a [[Question]] waits for the Routine's
[[Reply]] (ADR 0001 keeps the LLM out of the web app). The user wants a **persistent,
course-wide, 1-on-1 chat** with the AI ("chatroom" note, resolved 2026-07-15: not
multi-user). That's a new interaction plane and a new serving path — an always-on responder
— which tickets 02–04 (debate, guided discussion, apply-coaching) all ride on. Scope the
substrate once, here.

## Questions to answer

- **Serving path**: a Convex action calling the provider gateway
  ([`openrouterClient.ts`](../../../../convex/openrouterClient.ts) exists), the
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

---

**Depends on:** ai-chat/01

## Why

"AI able to debate and discuss the content" — free sparring: the AI takes a stance on a
lesson's claims and the learner argues, defends, or attacks. Pedagogically this is effortful
elaboration (the teach skill's desirable-difficulty principle applied to dialogue). Distinct
from ticket 03 (resolved 2026-07-15): debate is **unstructured sparring**; 03 is a **guided
format**.

## Questions to answer

- Entry point: a "debate this" affordance on a lesson (anchored, with the lesson in context)
  vs. a command inside Course Chat? Recommendation to test: lesson-anchored, runs in the same
  thread infrastructure.
- Stance policy: does the AI steelman positions it "knows" are wrong (classic debate
  practice) — and how do we stop a learner walking away believing the steelman? (Explicit
  debrief turn at the end? Grounding rules from 01 apply — citations required?)
- Scope of debatable content: factual courses (Hindi grammar) offer little to debate —
  is debate offered only where the material supports it (who decides: the Routine flags
  debatable lessons at authoring?)?
- Does a debate leave a trace — a learning record / capture entry the Routine reads for ZPD,
  or ephemeral?
- Win/lose/score, or purely conversational? (Recommendation: no scoring in v1.)

## Out of scope

- The chat substrate (01), the guided format (03).

## Deliverable

Entry-point + stance-policy decision, the debatable-content rule, and what (if anything) a
debate writes back to the Hub.

---

**Depends on:** ai-chat/01

## Why

"Discuss lesson where people can talk to AI (good cop/bad cop)" — a **structured** discussion
format on a lesson: two AI personas, one supportive (draws the learner out, affirms partial
understanding), one challenging (pokes holes, demands precision). This is the learning
pyramid's *discussion* step done in-platform (seam with pedagogy/01). Resolved 2026-07-15:
separate from free-form debate (02) because the value is the **format** — a sequence with
objectives and an end — not open sparring.

## Questions to answer

- Format design: what are the beats (recap → probe → challenge → synthesise?), how long, and
  what's the exit criterion — the discussion should *end* with something (a summary the
  learner writes? the AI's read on their understanding)?
- Personas: two personas from one model in one conversation (cheap, one call per turn) vs.
  two separate agents (theatrical, 2× cost)? How are they visually distinguished in the UI?
- When offered: after a lesson is completed? At the [[Frontier]] before the next lesson
  unlocks (a comprehension gate — ties to rich-media/07's remediation question)? Owner-only
  or every reader?
- Capture: does the closing synthesis land somewhere the Routine reads (learning record /
  capture) so discussion performance informs the next lesson?
- Naming: is this the canonical **Discussion** term for CONTEXT.md, or does 01 own that?

## Out of scope

- The chat substrate (01), free debate (02), multi-learner anything.

## Deliverable

The format spec (beats, exit, personas), the when-offered decision, and the capture rule.

---

**Depends on:** ai-chat/01

## Why

"How to apply outcomes (llm chat)" — a coaching conversation that bridges what a lesson
taught to the learner's actual life: their [[Mission]] is *why* they're learning; this chat
turns an outcome ("you can now conjugate X") into "here's what to do with it this week."
It's the conversational half of knowledge→wisdom; pedagogy/02 owns the structural half
(assignments). Keep the seam explicit or the two will grow into each other.

## Questions to answer

- Anchor: per-lesson ("apply this lesson") vs. course-wide ("what should I be doing with all
  of this")? Recommendation: per-lesson entry, mission-wide context.
- Inputs: Mission + the lesson's outcomes + Progress + learning records — is that enough, or
  does it need the learner's own situation elicited each time?
- Output: conversation only, or does it end in **committed action items**? If action items
  exist, do they become trackable (that's pedagogy/02's assignment concept — hand off, don't
  duplicate)?
- Follow-up: does the next session ask "did you do it?" — and does that report reach the
  Routine (capture kind)?
- Seam rule with pedagogy/02, written down: coaching = conversation, assignment = structure.

## Out of scope

- The chat substrate (01).
- Assignment tracking/structure (pedagogy/02).

## Deliverable

Anchor + output decision (conversation vs action items), the pedagogy/02 seam rule, and what
reaches the Routine.

## Done when

The serving-path + provider/metering decision (likely an ADR, since it bends ADR 0001), the grounding approach, the Question-coexistence rule, and the proposed CONTEXT.md term are all written down.

<!-- Migrated 2026-07-30 from GitHub issue #54 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
