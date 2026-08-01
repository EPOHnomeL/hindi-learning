---
type: task
blocked_by: []
---

# Streamline the routine's effort: course creation, lesson creation, Q&A

## Question

**Where it stands:** partial — AUTHORING contract + CAPTURE.json + deterministic setup shipped (df62360, a6c8c75); lean materialiseTopic digest, source-cache reuse, and curriculum outline remain

Priority: **high** — sits **above** the remaining `topic-sharing` / backlog
`ready-for-agent` items. Every run pays this tax; it compounds as Topics and
lessons grow, and it directly bounds Claude spend (issue 08's concern).

Context: [routine-prompt.md](../../../../docs/routine-prompt.md),
[routine.md](../../../../docs/routine.md),
[materialiseTopic](../../../../convex/routine.ts),
[ADR 0009](../../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md)
(Convex is SoT), [ADR 0010](../../../../docs/adr/0010-teaching-compute-swappable-adapter.md)
(swappable compute). Related: multi-topic
issue 06 (resource
ingestion), issue 07
(seed → mission bootstrap).

## Want

Cut the effort (tokens + wall-clock + round-trips) a single `teacher-next-lesson`
run spends, without lowering grounding/quality. The run should spend its budget
on **authoring**, not on rediscovering conventions, re-fetching sources, hunting
for state, or re-reading content it doesn't need.

The owner-discovery fix (commits `5c5b6be` / `47349c7`) is the template: hand the
agent authoritative state up front instead of making it derive or hunt for it.
This issue generalises that across the three hot paths.

## Evidence (one real bootstrap run)

From the `cyber-security-course` first run, the agent spent most of its turns on
overhead, not authoring:

1. **Manual dep install** — "Dependencies need installing. Let me set up first."
   The cloud setup script (`corepack enable` + `pnpm install --frozen-lockfile`,
   routine.md §2) should make this a no-op; it didn't.
2. **Owner hunt** — ~15 turns brute-forcing an owner email. **Fixed** (precedent
   for this issue).
3. **Cold rediscovery of conventions, every run** — read SKILL.md, all four
   `*-FORMAT.md`, `lessons/_partials/head.html` + `foot.html`, the reader routing
   scheme, iframe sandbox behaviour, and an example Hindi lesson to copy the quiz
   markup. ~10 reads of *static* convention that never changes between runs.
4. **Grounding from scratch** — web-searched, fetched, and char-by-char verified
   3 external sources (OWASP A03, PortSwigger, OWASP cheat sheet). None are
   persisted, so the next lesson re-fetches and re-verifies the same sources.
5. **Context bloat** — `materialiseTopic` returns **every** non-superseded
   lesson's full HTML, though ZPD calc mostly needs learning records + titles +
   the latest lesson. Cost grows with course length.
6. **Redundant Q&A round-trip** — `review:prod` ran even though `CAPTURE.json`
   (already materialised) showed no open questions and no activity.

## Plan (three hot paths)

### A. Course creation — make the expensive first run a real "course bootstrap"
Split **course creation** (one-time, expensive) from **lesson creation**
(incremental, cheap). The bootstrap run lays down durable scaffolding so every
later run is cheap and consistent:

- Draft the **Mission** (already done at bootstrap) **plus a lightweight
  curriculum outline / skill-tree** — the ZPD spine (ordered candidate skills).
  Persist it on the Topic (new field or a `references/_curriculum`), so
  lesson-creation runs *pick the next node* instead of re-deriving "what next"
  from learning records every time.
- **Cache verified primary sources as Resources** (`kind: "url"`) when the Topic
  has none. Once cached + verified, lesson 2..N reuse them — no re-fetch, no
  re-verify. (Dovetails with issue 06's ingestion.)

### B. Lesson creation — kill the per-run cold start
- **Authoring contract**: one compact doc the agent reads instead of spelunking
  SKILL.md + 4 FORMAT files + partials + an example lesson. Covers: lesson file
  shape, the **exact** captured-quiz markup (`.quiz[data-correct]`,
  `.opt[data-k]`, `.quiz.fill[data-answer]`), that head/foot are wrapped at
  publish (don't inline), reader cross-link routes
  (`/courses/<slug>/lessons|references/<key>`), citation format, and
  immutability/`supersedes`. Either ship it in the repo and point the prompt at
  it, or inject it into `topics/<slug>/` at materialise.
- **Lean context digest** from `materialiseTopic`: learning records (ZPD
  evidence) + lesson `{key,seq,title}` + glossary + **only the latest lesson's**
  full HTML. Fetch older full bodies on demand. Stops per-run cost scaling with
  course length.
- **Ready-to-fill lesson skeleton** in the workspace so the agent fills a
  known-good shell rather than reconstructing structure + quiz markup from an
  example each run.

### C. Q&A — collapse the round-trips
- **Fold review into materialise**: `CAPTURE.json` already carries open
  questions + responses + progress, so the agent can read it directly;
  `review:prod` is a redundant second pull. Keep `review` as a human convenience
  but drop it from the routine's hot path.
- **Short-circuit when empty**: no open questions ⇒ skip the reply phase
  entirely (don't spend a turn confirming "nothing to answer").
- **Batch replies**: one mutation answering N questions instead of one
  `reply:prod` invocation per question.

### Cross-cutting
- Make the cloud **setup script deterministic** so deps are always pre-installed
  (no per-run "let me install").
- Anywhere the agent currently *derives* state it could be *given*, give it
  (the owner-fix pattern).

## Acceptance

- [ ] A representative run's overhead (turns/tokens spent before the first
  authoring action) drops measurably vs. a current baseline — capture a
  before/after on one bootstrap + one incremental run.
- [ ] `materialiseTopic` returns a lean digest by default (latest lesson HTML
  only; older bodies on demand); prior-lesson context no longer scales O(all
  lessons) in tokens.
- [ ] The routine reads a single authoring contract instead of rediscovering
  conventions across ≥6 files each run.
- [ ] Verified primary sources discovered during a run are persisted as Topic
  Resources and reused (not re-fetched) on the next run.
- [ ] The routine no longer runs `review:prod` as a separate step, and skips the
  reply phase when there are no open questions.
- [ ] Deps are pre-installed by setup; no run performs a manual install.
- [ ] No regression in grounding/quality: lessons still cite verified sources and
  follow the captured-quiz markup; `pnpm run typecheck` + `pnpm test` green.

## Notes / decisions needed

- **Split bootstrap into its own run vs. keep mission+lesson-1 in one run?** A
  separate course-creation fire is cleaner but adds a gate state; folding the
  curriculum outline + source cache into the existing bootstrap is lower-risk.
  Pick one before starting Part A. (Likely `needs-triage` for that sub-decision.)
- **Where does the curriculum outline live** — a `topics.curriculum` field, a
  reserved `references/_curriculum`, or a learning record? Affects schema +
  publish.
- Keep changes behind the ADR 0010 adapter boundary so the runtime stays
  swappable.
- This issue is deliberately broad (one issue, as requested). If you'd rather
  track it as an epic, it splits cleanly into A / B / C + cross-cutting; say the
  word and I'll promote it to a PRD with sub-issues.

## Comments

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — the three remaining items are all still outstanding: `collectTopicContext` returns every non-superseded lesson's HTML (convex/routine.ts:621-630); no cross-run persistence of discovered sources as Resources (resources.ts has only user-upload paths); no curriculum/skill-tree field on `topics` (schema.ts:26-73). Note the OpenRouter prompt-builder *is* lean (authoring.ts:246-254) — the gap is `materialiseTopic` itself.

## Done when

The remaining items — lean materialiseTopic digest, source-cache reuse, curriculum outline — are decided and either landed or opened as implementation tickets, with the token and wall-clock effect measured rather than asserted.

<!-- Migrated 2026-07-30 from GitHub issue #58 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

---

## Context folded from the retired `authoring-efficiency` map (2026-08-01)

<!-- was .plan/maps/course-authoring/tickets/04-streamline-routine-effort.md; that single-ticket map was consolidated into course-authoring -->

- **Priority: high.** Every Routine run pays this tax and it compounds as Topics and lessons
  grow; it directly bounds Claude spend. Destination: the remaining effort-reduction items on
  a single `teacher-next-lesson` run — lean `materialiseTopic` digest, source-cache reuse,
  curriculum outline — decided and landed, with the token and wall-clock saving **measured**,
  not asserted.
- The AUTHORING contract, `CAPTURE.json`, and deterministic setup already shipped
  (`df62360`, `a6c8c75`) — this ticket is the tail, not the whole effort.
- Constraint: cut effort **without lowering grounding or quality**. A cheaper run that
  teaches worse is a regression, not a win.
- Relates to ADR 0009 (Convex is source of truth) and ADR 0010 (swappable compute).
- Measurement overlaps
  [Cost instrumentation](../../internal-course-studio/tickets/03-cost-instrumentation.md) —
  that ticket builds the per-run token recording this one wants to measure against. Do it
  first if the numbers aren't available.
- Skills: `/ponytail` (the point is *less* work per run), `convex:convex-expert`.
- **Out of scope:** changing the teaching loop's shape (ADR 0001) or the buffer-of-one gate —
  that's [Off-peak course generation](05-off-peak-course-generation.md).
