# PRD: Per-edition translation engine picker (free routine ⇄ Gemini)

Status: ready — grilled and agreed (2026-07-21).

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Edition**,
> **Lesson**, **Reference**. Builds on the course-translation feature
> (`convex/translate.ts`, `docs/translation.md`) and the Gemini cut-over that
> hard-wired all translation onto the in-Convex action (`3620d0e`).

## Problem Statement

Translation currently runs **only** through the in-Convex paid action
(`translateTopic`), which uses Gemini by default (`TRANSLATE_PROVIDER`). Gemini
is fast and high-quality but **spends tokens (real money) on every course**.

Before `3620d0e`, translation could instead be driven by the **free claude.ai
translate Routine** — a cloud Claude Code run that costs no per-token money but
is much slower. That path's writeback seams still exist
(`claimTranslation`/`publishTranslation`/`reportTranslation`), but the Fire POST
that kicks it off was deleted, so it can no longer be selected.

The owner wants to **choose the engine per edition**: translate for free first
(slow), then optionally re-run that edition through Gemini when the quality is
worth the tokens.

## Solution

Give each Edition a stored **engine** and expose it in the Editions panel:

- **`free`** — POST the claude.ai translate Routine (restored Fire POST). No
  token cost, slower.
- **`gemini`** — schedule the in-Convex `translateTopic` action (today's
  behaviour; follows `TRANSLATE_PROVIDER`, Gemini by default).

### UI (`src/app/_components/Editions.tsx`)

- **Add language**: a Free / Gemini engine picker, **defaulting to Free**.
  Gemini's label warns it uses tokens. No blocking confirm modal — the label is
  the warning.
- **Ready edition**: an always-visible engine toggle (Free | Gemini) + a
  **Re-translate** button. This is how a free edition gets upgraded to Gemini.
  The toggle reflects the engine that last produced the edition.
- **Failed edition**: Retry reuses the job's stored engine (no picker needed).

### Re-translate semantics (the crux)

Freshness is tracked by `sourceHash` (source content only — **not** which engine
produced the row). So switching engines must not be mistaken for "already done":

- Re-translate with a **different** engine than the job's stored one ⇒
  **force full redo** (ignore per-item freshness). This is what makes
  "free now, Gemini later" replace the whole edition.
- Re-translate with the **same** engine ⇒ cheap **resume/repair** (skip fresh
  items). Only the Gemini action skips fresh items; the free routine always does
  a full pass regardless.
- Existing jobs (no stored engine) count as **`gemini`** — today's behaviour, so
  **no migration**. Switching one to Free forces a redo.

Force never deletes existing rows up front (that would drop the reader to English
mid-run). `publishTranslation` replaces rows item-by-item as the new engine
produces them.

### Backend (`convex/translate.ts`)

- `translationJobs` gains an optional **`engine: "free" | "gemini"`** (reads
  default to `"gemini"` when absent).
- `startTranslation` / `tryAcquireTranslation` accept an optional `engine`:
  - provided (add-language / re-translate) ⇒ use it; if it differs from the
    stored engine, mark the run **forced**.
  - omitted (failed-retry) ⇒ reuse the job's stored engine.
- Restore `postTranslateFire` (POST `TRANSLATE_FIRE_URL` / `TRANSLATE_FIRE_TOKEN`).
  Engine `free` ⇒ POST the routine; engine `gemini` ⇒ schedule `translateTopic`.
  Missing free-routine env ⇒ a clear "free translation not configured" error
  (mirrors the existing fire-error surfacing).
- Thread **force** into `translateTopic` → `collectForTranslation` so `isFresh`
  is bypassed on a forced Gemini run (resume-within-run still handled by the
  `remaining` work-list).
- `claimTranslation` filters to **`engine === "free"`** jobs only, so a
  freshly-scheduled Gemini job can never be claimed by the cloud routine.
- `editions` query returns each edition's `engine` for the panel toggle.

## Out of scope / unchanged

- Single-flight lock, `STALE_MS` heartbeat/resume, whitelabel `translations`
  flag gating, the reader, per-item English fallback, quiz-structure guard.
- No per-item engine tracking (engine is per-edition/job).
- No cost estimate/confirm modal.
- Standing up the claude.ai translate Routine + its `TRANSLATE_FIRE_URL/TOKEN`
  is the operator's job (owner confirmed it's/will-be set up).

## Acceptance

- Adding a language defaults to Free and fires the routine; picking Gemini
  schedules the action.
- A free-translated ready edition can be re-translated with Gemini and every
  item is redone (not skipped as fresh).
- A Gemini edition re-translated with Gemini only redoes failed/changed items.
- Retry on a failed edition reuses its stored engine.
- Picking Free with the routine env unset surfaces a clear error, not a silent
  no-op.
- A scheduled Gemini job is never grabbed by the cloud routine.
