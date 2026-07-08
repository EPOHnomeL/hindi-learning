# PRD: OpenRouter provider line (GLM 4.2 authoring + Gemini translation)

Status: proposed — from the 2026-07-08 grilling session (grill-with-docs)

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md). This feature builds the
> first, spike-grade slice of
> [ADR 0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)
> (provider-agnostic teaching runtime). It **supersedes
> [ADR 0001](../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md)
> ("no LLM runs in the web app") on the OpenRouter path only** — the Claude path
> keeps ADR 0001 intact. New term: a course's **Provider** — `claude` (the
> existing claude.ai Routine) or `openrouter` (GLM 4.2 authoring, Gemini
> translation, run in Convex actions).

## Problem Statement

Course authoring and translation run exclusively on a **claude.ai Routine** — a
hosted Claude Code agent, structurally Anthropic-only (ADR 0010, ADR 0014). The
Convex side ([`convex/routine.ts`](../../convex/routine.ts),
[`convex/translate.ts`](../../convex/translate.ts)) is pure orchestration —
gate → lock → claim → fire → materialise → publish → report — and the
"intelligence" lives entirely in the cloud agent running the file-based `teach`
skill. There is no way to point authoring at a non-Claude model, and no way for
an owner to choose one.

We want to **try** other models: generate a course with **GLM 4.2** and
translate with **Gemini 3.5 Flash**, both reached through the **OpenRouter**
OpenAI-compatible gateway, and let the course owner pick Claude or OpenRouter at
creation time.

## Solution

Add a per-course **Provider**. A course created with `provider: "openrouter"`
routes all its teaching compute to **Convex Node actions** that call OpenRouter,
instead of firing the claude.ai Routine. The Convex orchestration seam
(gate/lock/report) is **reused unchanged**; only the *fire* step branches on
provider.

Because a Convex action has no filesystem and cannot run the Claude Code `teach`
skill, the OpenRouter path **ports the teach skill's instructions into the
prompt** (Option A): the verbatim `SKILL.md` + `AUTHORING.md` + `*-FORMAT.md`
become the system prompt, the full materialised context is injected, and web
search is enabled via OpenRouter's `web` plugin. This reproduces the teach
skill's output shape and philosophy; it does **not** reproduce Claude Code's
filesystem loop (no self-refinement, no file-based asset reuse).

Two authoring modes:

- **Setup / bootstrap** (a seeded Topic with no Frontier): a web-grounded,
  orchestrated multi-step pass — draft the Mission (web search) → publish →
  author Lesson 1 (web search) → publish.
- **Ongoing lessons** (a completed Frontier): a **single-pass** generation —
  full materialised context in → lean-fragment HTML out → wrap → publish.

Translation uses **Gemini 3.5 Flash**, single-pass per item, via the OpenRouter
action pattern. **Update (this branch): ALL translation runs on Gemini,
regardless of the course's authoring Provider** — the claude.ai translate Routine
is never fired. (This supersedes the original "translation follows the course's
Provider": a Claude-authored course now also translates through Gemini.) Requires
`OPENROUTER_API_KEY` on the deployment. Authoring still follows Provider.

Quality on GLM 4.2 / Gemini is **not guaranteed** — this is ADR 0014's
"reachable, not guaranteed" line, and a spike to see the output.

## Scope

**In scope (OpenRouter path):**

- Lesson authoring — setup (agentic + web search) and ongoing (single-pass).
- Translation — Gemini 3.5 Flash, single-pass per item.
- Auto-terminate + `~N` lesson-count estimate (the generator judges the mission
  against "Success looks like", the same as the teach skill).
- Reply to learner questions — **batched into the next authoring run** (matches
  the Claude path's delayed cadence per ADR 0001).
- Provider choice in the course-creation UI.

**Out of scope / deferred:**

- Per-course **model** picker and per-user **BYOK** keys — a single operator
  OpenRouter key + env-default model slugs only (the BYOK line is later ADR 0014
  work).
- **Emblem** on the OpenRouter path — a completed OpenRouter course falls back to
  the generic 🎓; the owner may set one. (GLM 4.2 can't generate images.)
- **Review** as a separate flow — it is only context the generator already
  consumes via `materialiseTopic`, so there is nothing to build.
- Self-refinement (author→preview→fix) and file-based asset reuse — inline a
  shared stylesheet per lesson instead.
- Porting the Claude path or the existing Hindi course to OpenRouter.

## Technical shape

- **Data model.** Add `provider: v.optional(v.union(v.literal("claude"),
  v.literal("openrouter")))` to the `topics` table; set in
  [`seedTopic`](../../convex/content.ts); **default `claude`**; existing courses
  (incl. legacy Hindi) read as `claude`.
- **Fire branch.** `tryAcquireGeneration` / `tryAcquireTranslation` and the
  `report*` mutations are unchanged. In the fire actions, `provider === "claude"`
  → POST the fire URL (today); `provider === "openrouter"` →
  `ctx.scheduler.runAfter(0, internal.<action>, { topicSlug })`. The OpenRouter
  path needs **no `claim` protocol** (the action is handed its topic directly).
- **Actions.** New Convex **Node actions** (`"use node"`) for authoring (setup +
  ongoing), translation, and (folded into authoring) reply. Each reads context
  via an internal materialise query, wraps the lean fragment + runs
  `shuffleQuizOptions` (reused from [`convex/quizShuffle.ts`](../../convex/quizShuffle.ts)),
  and calls the **existing** publish/report mutations
  ([`publishLesson`](../../convex/content.ts), `publishMission`,
  `upsertReference`, `publishLearningRecord`, `completeCourse`,
  `replyToQuestion`, `publishTranslation`, `report*`) with `PUBLISH_SECRET` from
  env — **no new publish code**.
- **Bundled assets.** A `pnpm` build script emits
  `convex/authoringAssets.generated.ts` holding the verbatim teach instructions
  (`SKILL.md` + `AUTHORING.md` + `*-FORMAT.md`) and the
  `lessons/_partials/{head,foot}.html`, so the filesystem-less action has them
  and they cannot drift.
- **Config (env).** `OPENROUTER_API_KEY`, `OPENROUTER_AUTHOR_MODEL` (GLM 4.2
  slug), `OPENROUTER_TRANSLATE_MODEL` (Gemini 3.5 Flash slug). Exact slugs
  verified at implementation time; env-overridable.
- **Constraints.** Convex actions cap at ~10 min wall-clock and have arg/return
  size limits — the agentic setup pass is bounded by that ceiling and by a step
  budget; one slow lesson must fit.

## User Stories

### Course owner — choosing a provider
1. As an owner, I want to choose Claude or OpenRouter when I create a course, so that I can try GLM 4.2 authoring.
2. As an owner, I want the create form to default to Claude, so that the quality-guaranteed line stays the safe default.
3. As an owner, I want my existing courses (and the Hindi course) to keep using Claude untouched, so that nothing regresses.
4. As an owner, I want the provider choice to be clearly labelled as experimental for OpenRouter, so that I understand quality isn't guaranteed.

### Learner — an OpenRouter course behaves like a Claude one
5. As a learner on an OpenRouter course, I want a Mission and first Lesson generated after seeding, so that the course starts the same way a Claude course does.
6. As a learner, I want the next lesson authored when I complete the frontier, so that the on-demand/daily fire works identically to the Claude path.
7. As a learner, I want lessons to look consistent (shared styling, working quizzes with shuffled options), so that they read as one course.
8. As a learner, I want my open questions answered on the next authoring run, so that Q&A works (with the same delay as today).
9. As a learner, I want a completed OpenRouter course to stop authoring and let me earn a certificate, so that completion works (falling back to the generic 🎓 emblem).

### Owner — translating an OpenRouter course
10. As an owner of a completed OpenRouter course, I want to translate it into a language using Gemini 3.5 Flash, so that I can create Editions.
11. As an owner, I want translation to reuse the existing Editions panel, status, and fallback-to-English behavior, so that the UX is unchanged.
12. As an owner of a Claude course, I want translation to keep using the claude.ai routine, so that provider choice stays consistent per course.

### Operator — configuration & safety
13. As the operator, I want a single OpenRouter API key and model slugs in Convex env, so that no per-user secrets exist yet.
14. As the operator, I want the teach instructions + head/foot partials bundled from their source files by a script, so that the action's prompt can't silently drift from the canonical skill.
15. As the operator, I want the OpenRouter path to reuse the existing gate/lock/report seam, so that single-flight, stale-lock recovery, and rate caps still hold.
16. As the operator, I want a failed OpenRouter run to surface as `failed` in the reader (retryable), so that errors are visible and recoverable — same as the Claude path.

## Testing (TDD)

Mock OpenRouter at the client boundary. Cover: provider persisted on `seedTopic`;
fire-step branches on provider (schedules the action vs POSTs the URL); the
gate/lock/report reuse; the HTML wrap + `shuffleQuizOptions` step; publish wiring
calls the right mutations with the right args; translation follows provider. Do
**not** assert on model output (non-deterministic).

## Open questions / risks

- GLM 4.2 quality on interactive-HTML authoring is unproven (accepted — spike).
- The ~10-min action ceiling may bite the web-grounded setup pass on slow
  models; bound steps and fail cleanly if exceeded.
- Exact OpenRouter slugs + tool/web-search support for GLM 4.2 and Gemini 3.5
  Flash to be confirmed at implementation time.
