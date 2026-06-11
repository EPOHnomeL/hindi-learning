# PRD — Served Teach (AI-tutored learning workspace)

> Status: conceptual capture of the project as built so far (Vite + Cloudflare
> Worker + Neon + R2 + Neon Auth), written ahead of a planned rebuild on
> Next.js + Convex + Vercel. This document is stack-agnostic: it describes WHAT
> the product does, not HOW the current stack does it.

## 1. Vision

A personal, AI-tutored learning system. A human **learner** pursues a long-term
**mission** (e.g. "read the Hindi Bible unaided"); an AI **teacher** (Claude, via
the `teach` skill) authors short, beautiful, tightly-scoped **lessons** grounded
in that mission and in the learner's zone of proximal development. Lessons are
served to a web **reader** the learner opens on any device. The reader feeds the
learner's answers, progress, and questions back to the teacher, forming an
asynchronous two-way conversation. A daily automation produces the next lesson.

The local teaching workspace (markdown + HTML files, driven by Claude Code) is
the **source of truth**; the web app is a publish/serve/capture surface over it.

## 2. Users

- **Learner** — reads lessons, takes inline quizzes, marks progress, asks
  questions. One learner per account today; multi-learner is plausible later.
- **Teacher (AI)** — Claude running the `teach` skill in the workspace: reviews
  the learner's state, answers questions, authors the next lesson/reference,
  publishes.

## 3. Problem

Self-directed learning stalls without (a) a tight feedback loop, (b) content
pitched at the right level, and (c) continuity across sessions. Generic tools
don't ground lessons in a personal mission or adapt to demonstrated
understanding. This product makes an AI tutor that authors bespoke, citeable
lessons and learns what has actually landed from real quiz/question evidence.

## 4. Core concepts (domain model)

- **Mission** — why the learner is learning; grounds every lesson. (`MISSION.md`)
- **Topic** — the subject space (v1: a single topic, `hindi`).
- **Lesson** — one self-contained HTML artifact teaching ONE thing; ordered;
  **immutable once published** (a replacement supersedes the old one).
- **Reference** — a mutable, reusable artifact (glossary, grammar cheat-sheet);
  edited in place and re-published; the current version always wins.
- **Learning Record** — an ADR-style note capturing a non-obvious insight about
  what the learner has learned; drives next-lesson planning.
- **Resources / Notes** — trusted source list; teaching preferences.
- **Capture data** (the conversation loop):
  - **Response** — the learner's (first) answer to a quiz, auto-recorded.
  - **Progress** — per-lesson opened / completed state.
  - **Question** — something the learner got stuck on; has a status
    (open → answered) and the teacher's reply.

## 5. Functional requirements

### Authoring loop (teacher side)
- FR1. Read mission, learning records, references, and existing lessons to
  compute the next thing to teach (zone of proximal development).
- FR2. Author a lesson as a self-contained, beautiful, citeable HTML document
  with at least one interactive quiz; never trust parametric knowledge — verify
  facts against trusted sources.
- FR3. Maintain references (esp. a glossary) and keep them current.
- FR4. Record a learning record after each lesson.
- FR5. **Publish**: push new/changed artifacts to the reader idempotently;
  lessons are immutable, references upsert-on-change, supersede retires old
  lessons.

### Reader (learner side)
- FR6. Authenticated, per-learner access.
- FR7. List lessons (in order) and references; open and read any artifact on any
  device.
- FR8. Inline quizzes (multiple-choice + fill-in) that give immediate feedback
  and auto-record the learner's first answer.
- FR9. Let the learner ask a question from within a lesson; show the teacher's
  reply inline when answered.
- FR10. Track and show progress (opened/completed) per lesson.

### Conversation loop (teacher side)
- FR11. **Review**: read open questions + per-lesson responses and progress.
- FR12. **Reply**: answer a question; flip it to answered; reply shows in reader.
- FR13. Use responses/progress as evidence for next-lesson planning.

### Automation
- FR14. A scheduled daily job runs the authoring + conversation loop end-to-end:
  review → answer questions → author the next lesson → publish → deliver.

## 6. Non-functional requirements

- **Low operational surface** — minimise bespoke infra; prefer managed,
  batteries-included services. (Primary motivation for the rebuild.)
- **Frictionless auth** — sign-in must "just work"; no hand-rolled JWT/cookie
  plumbing.
- **Typed, validated env config** — no silent misconfiguration.
- **Realtime-ish reader** — answered questions / new lessons appear without
  manual cache-busting.
- **Idempotent publishing** — safe to re-run anytime.
- **Beautiful, printable artifacts** — typography matters; learners revisit them.
- **Mobile-first reading.**

## 7. Current architecture (being replaced)

- **Reader**: Vite SPA (React).
- **Edge/API**: Cloudflare Worker (Hono) — serves the SPA + a small API; proxies
  `/api/auth/*` same-origin to Neon Auth to keep the session cookie first-party.
- **DB ("the Hub")**: Neon Postgres (`lessons`, `topic_references`, capture
  tables). Branch-per-environment (dev / test / prod).
- **Artifact store**: Cloudflare R2 (HTML blobs), written via `wrangler r2
  object put`.
- **Auth**: Neon Auth (Better Auth-based); worker verifies a JWT via JWKS.
- **CLI**: `publish` / `review` / `reply` / `seed` / `migrate` scripts run from
  the local workspace.

### Pain points driving the rebuild
- Auth: third-party cookie / same-origin proxy / JWKS / trusted-origins fragility.
- Many credentials across Neon + Cloudflare; env vars duplicated across
  `.env` / `.dev.vars` / `.env.production` / Wrangler secrets / routine env.
- R2 writes shell out to `wrangler`; multiple branches to keep in sync.
- No realtime; manual publish/cache concerns.

## 8. Out of scope (v1)
- Conversational/spoken practice (reading is the priority).
- Multiple simultaneous learners / sharing.
- Spaced-repetition scheduling engine (lightweight recall only, by the teacher).
- Non-Hindi topics (the model is general, but v1 ships one topic).

## 9. Success metrics
- The learner reaches mission waypoints (e.g. fully parses Psalm 1, then 1:2…).
- Daily lesson is produced and delivered without manual intervention.
- Questions are answered within a day.
- Quiz accuracy / completion trends upward over time.

## 10. Data that exists today (for migration decisions)
- **In local files (regenerable)**: mission, lessons HTML, references HTML,
  learning records, glossary, resources/notes. → keep; re-publish into new stack.
- **Only in the DB (would be lost if dropped)**: the learner's capture history —
  quiz responses, progress, questions + replies. → decide: export & migrate, or
  start fresh.
