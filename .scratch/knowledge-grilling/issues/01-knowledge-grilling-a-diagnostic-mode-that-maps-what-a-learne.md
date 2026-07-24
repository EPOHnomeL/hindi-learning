# knowledge-grilling/01: Knowledge grilling: a diagnostic mode that maps what a learner doesn't know

**Status:** open (deferred tracker) — the grill-my-knowledge skill exists (df330ef); the in-app diagnostic mode (schema/route + ADR decision) is not built
**Depends on:** the `grill-my-knowledge` and `teach` skills (the behaviour being productised); the **Routine** authoring loop (ADR-0009), the consumer of the gap map; productisation lines (ADR-0014) — if the live-model path is chosen, grilling inference is metered like other teaching compute
**Imported:** from GitHub #27 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/knowledge-grilling/issues/01-grill-diagnostic-mode.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/knowledge-grilling/issues/01-grill-diagnostic-mode.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Topic**, **Mission**, **Lesson**, **Response**, **Question**, **Progress**, **Frontier**, **Routine**, **Reference**).
Related specs: [`../../served-teach-app/PRD.md`](../../served-teach-app/PRD.md), [`../../course-authoring/`](../../course-authoring/), [`../../product-direction/ROADMAP.md`](../../product-direction/ROADMAP.md).
Related ADRs: [0001 — asynchronous hub-mediated teaching loop](../../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md), [0009 — content source of truth in Convex](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md), [0014 — provider-agnostic teaching runtime](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md).
Prior art (the skill this is drawn from): `grill-my-knowledge` (examiner-style diagnostic) and `teach` (the authoring loop it hands off to), both Claude Code skills today.

Today the loop only learns what a learner *doesn't* know **indirectly** — by watching **Responses** to quiz prompts a **Lesson** happened to include, or a **Question** they thought to ask. There is no deliberate act of *finding the edge* of someone's understanding before teaching them.

The `grill-my-knowledge` skill already does exactly this in a Claude Code terminal: it interviews the learner one question at a time, **withholds all answers and corrections** (grading mid-session contaminates the diagnosis), follows each thread until the answers slide from recall into guessing, grades every branch **solid / shaky / missing**, and emits a **gap map** — an ordered teaching agenda handed straight to `teach`.

That is a strong fit for this product: it is the placement diagnostic the **Routine** currently lacks. A grill run would let the teacher start a **Mission** at the learner's real zone of proximal development instead of guessing, and re-grill later to verify mastery rather than infer it from clicks. This issue scopes bringing that skill into the app as a first-class **diagnostic mode**.

We want a learner-facing **grilling** mode on a Topic that:

- Interviews the learner **one question at a time**, adapting each follow-up to the previous answer, pushing a branch until it finds the edge — never revealing answers mid-session.
- Grades each branch **solid / shaky / missing** and produces a **gap map**: the shaky+missing items ordered by leverage (foundational blockers first), plus the solid items flagged as demonstrated so the teacher skips re-teaching them.
- **Feeds the gap map back into the teaching loop** so the Routine authors (or reorders) Lessons against the diagnosed gaps, and marks demonstrated knowledge as already-mastered — closing the same loop Responses/Questions close today, but *ahead* of teaching rather than after it.

Two natural entry points to settle at triage:
- **Placement** — grill at Topic **Seed** / early Mission so the first Lessons land at the right level.
- **Checkpoint** — grill at a **Frontier** or on **Completion** to confirm mastery before advancing or certifying.

### The central design question (must resolve at triage before anything is built)

**Grilling is inherently a live, adaptive, model-in-the-loop interview. The web app deliberately has no LLM in it (ADR-0001) — all teaching intelligence lives in Claude Code / the Routine.** These two facts collide. Three candidate resolutions, in rough order of least-to-most architectural disruption:

1. **Routine-mediated, asynchronous (preserves ADR-0001).** The Routine runs the grill; each learner answer is captured like a Response, each next question authored like a Reply/Lesson. *Cost:* a fluent one-question-at-a-time interview becomes hours between turns — arguably fatal to the UX that makes grilling work. Might be acceptable only for a coarse, few-question placement pass, not a real grill to the edge.

2. **Pre-authored branching grill (hybrid, mostly preserves ADR-0001).** The Routine authors a decision-tree grill artifact (a served interactive Lesson) with pre-baked follow-ups; the browser walks the tree with no live model, and anything off-tree is deferred to the Routine. *Cost:* not truly adaptive — it can only find edges it anticipated. Grading (solid/shaky/missing on free-text) still wants a model.

3. **Live model in the app (breaks ADR-0001 as written).** A model drives the grill in real time. This is the first feature that would put inference in the serving path — but note the runtime is now **provider-agnostic** (ADR-0014, the Managed / BYOK lines), so "a model reachable from the app through the gateway" is no longer unthinkable the way it was at ADR-0001. If we go here, ADR-0001 needs an explicit amendment, and metering ties into the Managed/BYOK productisation.

**Recommendation to weigh:** grilling may be the forcing function that revisits ADR-0001. Decide *this* first; the rest of the acceptance criteria depend on which path wins.

### Backend gaps (net-new — why this is a feature, not a tweak)

- No entity for a diagnostic session or a gap map; Responses are answers to *Lesson* prompts, not to an adaptive interview with no Lesson.
- No way for the Routine to be told "the learner already knows X — do not teach it," only what they got wrong on a quiz.
- No inference path in the serving layer at all (ADR-0001) — path 2/3 would introduce one.

## Acceptance criteria

To refine at triage, path-dependent.

- A new domain term for the diagnostic session and its output (**gap map** is the skill's word; coin a canonical CONTEXT term via `domain-modeling` — candidates: *Diagnostic*, *Assessment*, *Grill*). Decide its relationship to **Response** (a grill answer is diagnostic, not a Lesson-prompt Response) and to **Progress**.
- Hub schema for a grilling session: the branches probed, per-branch grade, the ordered gap list, and the demonstrated (solid) items — all `user_id`-scoped, keyed to a Topic.
- A read path for the Routine to consume a gap map when authoring/reordering, and to mark demonstrated items so they aren't re-taught (sibling to how it reads Responses/Questions/Progress today, ADR-0009).
- A surface/route for the grill mode (e.g. a Topic action "Test what I know →"), owner-only.
- Whichever interview mechanism the design question selects (async Routine turns / branching artifact / live model), specified concretely.

## Notes

- **Owner-only.** A **Viewer** writes nothing (CONTEXT: Viewer) and a **Guest** has no server-side state — grilling is a self-directed act on one's own Topic. Confirm it never surfaces to Viewers.
- **Faithfulness risk.** The value is in *withholding* answers and pushing to the real edge. A watered-down "quiz that tells you the answer" is not this feature — guard that in the spec.
- **Grading free-text.** Solid/shaky/missing on prose answers is a model judgement; note this pushes toward path 2/3 and away from a purely dumb browser.
- **Scope guard.** This is diagnosis feeding the existing teach loop, not a second teaching engine. The gap map's only job is to steer the Routine.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no diagnostic/grilling schema (full schema reviewed), no route or surface in the app, no gap-map read path for the Routine, and no ADR. Only the standalone `grill-my-knowledge` agent skill exists, outside the app.
