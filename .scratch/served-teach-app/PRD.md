# PRD: Served Teach App (v1)

Status: done — shipped on Convex + Next.js (ADR 0009) and deployed on Vercel (rearchitected from the Neon/R2/Hono plan)

> Vocabulary in this document follows [`CONTEXT.md`](../../CONTEXT.md). Decisions follow ADRs [0001](../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md), [0002](../../docs/adr/0002-local-workspace-source-of-truth-neon-mirror-via-mcp.md), [0003](../../docs/adr/0003-immutable-lessons-mutable-references.md), [0004](../../docs/adr/0004-cloudflare-access-for-v1-auth.md), [0005](../../docs/adr/0005-r2-for-artifact-blobs-served-privately.md).

## Problem Statement

I generate teaching material with Claude Code's `teach` skill — beautiful, interactive HTML **Lessons** and durable **Reference** cheat-sheets, grounded in a **Mission** (for v1: learning Hindi from the Bible and a handbook). But that material is trapped in a local workspace of files. I can only consume it where Claude Code is running, and the "ask my teacher a follow-up" loop only exists in a live terminal session.

I want to read my lessons and references on the web, at my own domain, from any device — and I want the interaction to flow back: when I answer a quiz, write something, or get stuck and ask a question, that signal should reach Claude Code so it can refine what it teaches me next. Today there is no path from "me reading on the web" back to "Claude Code teaching me better."

## Solution

A web app, served on my domain and gated to me by Cloudflare Access, that displays my published Lessons and References and captures my interactions back into a shared **Hub** (Neon). The web app holds no AI — it is a deliberately "dumb" reader and capture surface. Claude Code remains the only teacher: it **Publishes** authored artifacts outbound (HTML blobs to the **Artifact store** (R2) via `wrangler`, metadata to the Hub via the Neon MCP) and reads my **Responses** and **Questions** back inbound via the Neon MCP to drive the next authoring round.

The "back and forth" is real but asynchronous and Hub-mediated: I respond on the web now; Claude Code reacts later, either by writing a **Reply** bound to my Question (transitioning it `open → answered`) or by authoring the next Lesson. The database is the conversation.

## User Stories

### Reading & navigation
1. As a learner, I want to log in at my domain via Cloudflare Access, so that only I can see my study material.
2. As a learner, I want to see my list of **Topics**, so that I can choose what subject to study (v1: Hindi).
3. As a learner, I want to open a Topic and see its **Mission**, so that I remember why I'm learning it.
4. As a learner, I want to see a Topic's Lessons in their authored order, so that there's a clear sense of sequence and "what's next."
5. As a learner, I want to open any Lesson at any time (free navigation, not a locked sequence), so that I can revisit or jump ahead.
6. As a learner, I want a Lesson's HTML to render exactly as Claude Code authored it (beautiful typography, citations, interactive widgets), so that the served experience matches the artifact.
7. As a learner, I want to browse a Topic's References separately from its Lessons, so that I can quickly reach the durable cheat-sheets I return to.
8. As a learner, I want a Reference to always show its current revised version, so that I'm reading the latest compressed knowledge.
9. As a learner, I want to read all of this on my phone, so that I can study away from my desk.

### Capturing interaction (the inbound loop)
10. As a learner, I want to answer a quiz prompt inside a Lesson and have my selection captured as a **Response**, so that Claude Code can see what I got right or wrong.
11. As a learner, I want to type a free-text answer to a prompt and have it captured as a Response, so that richer signal (e.g. a Hindi sentence I wrote) reaches Claude Code.
12. As a learner, I want immediate in-browser feedback on a quiz Response (right/wrong) where the Lesson defines it, so that the feedback loop is tight even before Claude Code reacts.
13. As a learner, I want each Response tied to the specific prompt within the specific Lesson, so that my feedback history stays meaningful.
14. As a learner, I want an always-available "ask my teacher" box in every Lesson, so that I can raise a **Question** the moment I'm confused.
15. As a learner, I want a Question captured against the Lesson (not a prompt), so that it reads as an unprompted query, not an answer.
16. As a learner, I want my Question to show as `open` until answered, so that I know it's queued for Claude Code.
17. As a learner, I want opening a Lesson to mark its **Progress** `opened`, and finishing it to mark `completed`, so that the web shows where I am and Claude Code can tell what I actually opened.

### Closing the loop (the outbound/return leg)
18. As a learner, I want to see Claude Code's **Reply** to a Question inline with the Question I asked, so that the exchange reads as a conversation.
19. As a learner, I want a Question to flip to `answered` once a Reply exists, so that I can tell resolved from outstanding.
20. As a learner, I want a place to see all my open Questions across a Topic, so that I can track what I'm still waiting on.
21. As a learner, I want newly published Lessons to appear in the Topic automatically, so that Claude Code's next teaching shows up without me doing anything.

### Authoring & publishing (Claude Code as actor)
22. As Claude Code, I want to read a learner's Responses for a Topic via the Neon MCP, so that I can judge what has been mastered and recompute the zone of proximal development.
23. As Claude Code, I want to read a learner's open Questions via the Neon MCP, so that I have an explicit to-do queue for the next session.
24. As Claude Code, I want to read Progress markers via the Neon MCP, so that I can spot a Lesson the learner opened but left no Responses on (stuck).
25. As Claude Code, I want to Publish a new Lesson by uploading its HTML blob to the Artifact store and inserting a metadata row in the Hub, so that it becomes readable on the web.
26. As Claude Code, I want to Publish a revised Reference by overwriting its blob and upserting its metadata, so that the current version always wins.
27. As Claude Code, I want to write a Reply bound to a specific Question, so that the learner sees an answer where they asked it and the Question becomes `answered`.
28. As Claude Code, I want to supersede a broken Lesson (mark the old one superseded, publish a new one) rather than edit it in place, so that existing Responses keep pointing at real prompts.
29. As Claude Code, I want Publish to be an explicit command, not a live sync, so that the local workspace stays the source of truth and the Hub only updates when I say so.

### Operational
30. As the operator, I want the Artifact store bucket to be private and served only through the worker, so that gated study material can't be reached around Cloudflare Access.
31. As the operator, I want every row scoped by `user_id`, so that adding real accounts later (the "teach me anything" future) is additive, not a migration.
32. As the operator, I want immutable Lesson HTML to be cacheable by content, so that serving is cheap and fast.

## Implementation Decisions

### Architecture (per ADRs)
- **No LLM in the web app.** The web serves static-rendered HTML (no server-side rendering, no model) with client JS that POSTs interactions to the worker. All teaching intelligence stays in Claude Code (ADR-0001).
- **Local teach workspace is the source of truth.** The Hub is a published mirror + inbox. Content flows outbound by Publish; learner signal flows back via the Neon MCP (ADR-0002).
- **Two storage systems.** R2 (Artifact store) holds Lesson/Reference HTML blobs; Neon (Hub) holds the index + conversation, bridged by an R2 object key on each metadata row (ADR-0005).
- **Auth is Cloudflare Access** gating the whole app to one identity; no in-app auth code in v1; `user_id` retained on every row (ADR-0004).

### Modules
- **Capture protocol** *(deep)* — a small client SDK embedded by Lesson HTML exposing a stable interface: `capture.response(promptId, value)`, `capture.question(text)`, `capture.progress(state)`. Server-side it validates and persists each payload. Interface stability matters because Claude Code generates Lessons against it.
- **Hub repository** *(deep)* — all Neon data access behind one interface covering Topics, Lessons, References, Responses, Questions, Replies, Progress. No HTTP, no R2.
- **Question lifecycle** *(deep)* — pure state logic for `open → answered` and binding a Reply. No I/O.
- **Publish planner** *(deep)* — pure function `(workspace files, current hub state) → publish plan`: which blobs to put, which metadata rows to insert vs upsert, what to mark superseded. Execution (wrangler put + Neon writes) is a thin side-effecting shell around the pure plan.
- **Artifact store adapter** *(glue)* — `get(key)` / `put(key, html)` over the R2 binding; the worker streams blobs behind Access.
- **Hono worker routes** *(glue)* — HTTP surface wiring the above: serve Lesson/Reference HTML, list Topics/Lessons/References, POST capture payloads, GET Question/Reply threads, update Progress.
- **Reader UI (Vite + Cloudflare)** *(glue)* — Topic list, Lesson view (renders served HTML and mounts capture widgets), Reference view, Question/Reply thread, Progress indicators.

### Schema (Hub / Neon) — entities, not columns-final
- `users` — scoping anchor (single user in v1).
- `topics` — `user_id`, title, mission text. One per teach workspace.
- `lessons` — `topic_id`, author order (sequence within Topic), title, R2 key, supersede status (`active | superseded_by <id>`). Immutable artifact.
- `references` — `topic_id`, title, R2 key, current version marker. Mutable (overwritten on Publish).
- `responses` — `lesson_id`, `prompt_id` (the prompt within the Lesson), kind (`quiz | free_text`), value, correctness (nullable), created timestamp.
- `questions` — `lesson_id`, text, lifecycle (`open | answered`), created timestamp.
- `replies` — `question_id`, text, created timestamp (presence flips Question to `answered`).
- `progress` — `lesson_id`, state (`unseen | opened | completed`), updated timestamp. One row per learner-Lesson.

### Capture protocol contract (the loop's invariant)
- A **Response** always references a `(lesson_id, prompt_id)` and carries a `kind`; quiz Responses may include correctness computed in-browser from data baked into the Lesson.
- A **Question** references only a `lesson_id` (never a prompt) and is born `open`.
- A **Progress** update is idempotent per `(user, lesson)` and only advances (`unseen → opened → completed`), never regresses.
- Payloads are validated server-side before persistence; malformed or prompt-less Responses are rejected.

### Publish contract
- Publishing a **Lesson**: `wrangler r2 object put` the HTML blob, then insert a `lessons` metadata row referencing the R2 key. Lessons are never updated in place.
- Publishing a **Reference**: overwrite its R2 blob and upsert its `references` row (current version wins).
- Superseding a Lesson: mark the old row `superseded_by` the new Lesson's id; both blobs remain in R2.
- Writing a **Reply**: insert a `replies` row bound to the Question, which flips the Question to `answered`.
- Reading signal: Claude Code reads `responses`, `questions` (open), and `progress` for a Topic via the Neon MCP.

### Serving contract
- Lesson/Reference HTML is served **through the worker** via the R2 binding (never a public bucket URL), inheriting the Access gate.
- Immutable Lesson HTML may be cached aggressively by content/id; References are served as current-version (cache-busted on revision).

## Testing Decisions

**What makes a good test here:** assert external behavior, not implementation detail. For the Capture protocol, that means "a valid Response payload results in a persisted Response tied to the right prompt; a prompt-less Response is rejected" — not which function formatted the SQL. For the Publish planner, "given this workspace and this hub state, the plan inserts these Lessons and upserts these References and supersedes that one" — independent of how wrangler is invoked. Tests target the stable interfaces of the deep modules so they survive refactors.

**Modules to be tested** (all four deep modules, per developer decision):
1. **Capture protocol** — validation + persistence of Response / Question / Progress payloads: correct payloads persist with the right associations; malformed/prompt-less Responses rejected; Progress advances but never regresses; a Question is born `open`.
2. **Hub repository** — data access for every entity, exercised against a **Neon test branch**: round-trip writes/reads, `user_id` scoping, supersede status, Reply-presence flipping a Question to `answered`.
3. **Question lifecycle** — pure `open → answered` transitions and Reply binding, with no I/O; illegal transitions rejected.
4. **Publish planner** — pure `(workspace, hub state) → plan` with in-memory fakes: new Lesson → insert; revised Reference → upsert; broken Lesson → supersede; unchanged artifacts → no-op.

**Prior art:** none — this is a fresh repo. Recommended stack: **Vitest** for the pure/client modules (1, 3, 4 with in-memory fakes), a **Neon test branch** for the repository (2), and a few **Miniflare / `wrangler dev`** integration tests for the worker routes. The Reader UI is covered by integration/e2e, not unit tests.

## Out of Scope

- **Live AI tutor on the web.** No model runs in the served app; follow-ups are answered asynchronously by Claude Code (ADR-0001).
- **Multi-user accounts, signup, roles, teams.** v1 is single-user behind Cloudflare Access; `user_id` scoping is the only forward-compatibility carried (ADR-0004). The "teach me anything" multi-Topic-per-other-people future is later.
- **Rewriting the teach skill to be database-native.** The skill stays file-based; we add a Publish seam (ADR-0002).
- **In-place editing of Lessons.** Refinement is append/supersede only (ADR-0003).
- **Real-time notifications** (push/email when a Question is answered). The learner sees `answered` state on next visit.
- **Authoring/editing content in the web app.** The web is read + capture only.
- **A public/shareable view of lessons.** Everything is private behind Access.

## Further Notes

- The single soft spot from design — pushing multi-KB HTML through MCP SQL — was eliminated by storing blobs in R2 via file-based `wrangler r2 object put` (ADR-0005). Watch the wrangler publish path during build; if it gets awkward, a small dedicated publish endpoint on the worker is the fallback.
- Immutable Lessons + R2 means Lesson HTML can be cached by content indefinitely; this pairs with ADR-0003 and should be exploited in the serving layer.
- The Capture protocol is the contract Claude Code generates Lessons against — treat its interface as a published API and version it deliberately if it ever changes.
- Tech stack (Vite-Cloudflare, Wrangler, Hono, Neon, R2) is the carrier for the design, not itself a contested decision; no ADR was warranted for the framework choices.
