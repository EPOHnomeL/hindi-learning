# PRD: Estimated lesson count ("~N lessons")

Status: shipped — issues 01 + 02 built, tested, committed; surface moved to the dashboard card (see Revision)

> **Revision (2026-07-08, post-ship):** the surface moved. v1 shipped the number
> in the reader's lesson-actions area (beside "Generate next lesson"); it now
> lives on the **dashboard course card** (owner-only), on the lesson-count line as
> `2 / 3 lessons · ~6 total`. The read path is `content.dashboard` (owner-scoped
> by construction), not `generationStatus`. Clamp + gating semantics are
> unchanged. Surface-specific wording below (Solution, story 2, the Read-path /
> Display decisions, Out of Scope's "dashboard" bullet) reflects the original
> plan; the two decision bullets are corrected in place.

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Lesson**,
> **Routine**, **Frontier**, **Mission**, **owner** vs **Viewer**, **Completion**,
> and the **generation** status/lock. This feature adds one term: a Topic's
> **estimate** (its estimated eventual Lesson count). The estimate is a *soft*
> display artefact and does **not** change the emergent teaching model — it
> respects [ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md)
> ("no fixed syllabus / no lesson quota"); a short new ADR records why the
> estimate must never be turned into a quota.

## Problem Statement

From the owner's side: while a course is being built, there is no sense of *how
big it will be*. Generation is emergent — the Routine authors one Lesson at a
time and only decides to stop when the Mission is met — so the eventual size of
the course is invisible until it ends. An owner watching "Generating next
lesson…" has no idea whether they're near the start or near the finish, and when
they ask a question that leads the teacher to cover more ground, nothing tells
them the course just got bigger.

## Solution

The owner sees a single soft number — **`~N lessons`** — the course's estimated
eventual total, shown in the reader's generation-status area (beside the
"Generate next lesson" control). The teaching Routine emits its best guess at the
end of each run, so the estimate refreshes whenever the Routine runs (initial
setup, the daily cron, or a press of "Generate next lesson"). It is allowed to be
roughly right — drift of about ±1 is expected and fine — so there is no
"last updated" chrome and no list of upcoming Lesson titles.

The estimate is **advisory only**: it is pure display and never constrains the
Routine. Termination still happens on the teacher's Mission judgement, exactly as
today. Because questions already feed the next run (the Routine reads open
questions when it authors), the "a question grew the course" story is covered
**implicitly**: after the owner asks a question, the next run may raise its
estimate and the number simply ticks up — there is no per-question attribution,
tag, or callout.

It is **owner-only**. A Viewer, a Guest on a public link, and the dashboard do
not show it. It appears once an estimate exists (so nothing shows on a freshly
**seeded** Topic before its first run), and it is hidden again once the course is
**completed** (the real count is then known and an estimate is moot).

## User Stories

### Seeing the estimate
1. As an owner, I want to see roughly how many Lessons my course will contain while it's still being built, so that I can gauge its scope and how far along I am.
2. As an owner, I want the estimate shown right where generation happens (next to "Generating next lesson…" / "Generate next lesson"), so that scope and progress live in one place.
3. As an owner, I want the estimate to read as an approximation (`~N lessons`), so that I understand it's a guide, not a promise.
4. As an owner, I want the estimate to update on its own after each teaching run, so that it tracks the course as it grows without me refreshing anything.
5. As an owner, I want nothing shown before my course's first run (while it's still seeded), so that I don't see an empty or fake placeholder.
6. As an owner of a finished course, I don't want an estimate any more — the course is complete and its real Lesson count stands on its own.
7. As an owner, I never want the estimate to read as *fewer* Lessons than my course already has, so that it never looks obviously wrong.

### Questions growing the course
8. As an owner, when I ask a question that leads my teacher to cover more, I want the estimate to rise on the next run, so that I can see my question expanded the course.
9. As an owner, I accept that this rise appears after the next teaching run, not the instant I ask, because my teacher only thinks between runs.

### The teacher (Routine / teach skill)
10. As the teach skill, I want to report my best-guess total Lesson count at the end of each run, so that the owner can see the course's estimated size.
11. As the teach skill, I want to publish the estimate through the same secret-guarded report step I already run every time, so that there is no extra call or workflow to maintain.
12. As the teach skill, I want the estimate to be explicitly non-binding — a forecast I revise freely, never a quota I must author up to — so that I never manufacture busywork Lessons to hit a number.

### Access
13. As a Viewer of a shared course, I do not see the owner's estimate, so that a shared or public course never reads as "unfinished".
14. As the system, I want the estimate exposed only through an owner-resolved read, so that it can't leak to a Viewer or Guest regardless of the UI.

## Implementation Decisions

- **Storage: one optional number on the Topic.** Add `topics.estimatedLessons`
  (optional). It is a property of the course, not of the generation lock, so it
  lives on the Topic and survives across runs; a Topic that has never been
  estimated simply has no value.
- **Write path folds into the existing report step — no new CLI or mutation.**
  The Routine already ends every run by calling `reportGeneration` (via the
  `report` script). Extend `reportGeneration` with an optional `estimatedLessons`
  arg (still `PUBLISH_SECRET`-guarded, like today) that patches the Topic when
  present and leaves it untouched when absent. The `report` script gains an
  optional `--estimate <n>` flag. This keeps the estimate conceptually part of
  "here's how this run ended," with the slug already in hand.
- **Read path clamps server-side.** _(Corrected — see Revision.)_ Extend the
  existing `content.dashboard` query (owner-scoped by construction — it returns
  only the caller's own Topics, so the estimate can never reach a Viewer's shared
  card) to return the estimate, **clamped** to `max(estimatedLessons,
  publishedCount)` using the `topicLessonCounts` count it already computes. It
  returns no estimate when the Topic is `seeded` or `completed`, so the card
  renders nothing in those states without its own lifecycle logic. An
  already-clamped, already-gated number keeps the card a pure render.
- **Display: on the dashboard course card.** _(Corrected — see Revision.)_ On the
  owner's own course card, append `~{n} total` to the existing lesson-count line
  (`2 / 3 lessons · ~6 total`). Absent when the query returns no estimate. No new
  surface, expander, or list; shared/purchased cards (a different query) never
  show it.
- **Agent contract: two short doc edits.** Add one line to the canonical Routine
  instructions (`docs/routine-prompt.md`) and a short note to the teach skill
  (`SKILL.md`): each run, emit a best-guess **total** Lesson count for the course
  via `report … --estimate <n>`; it is a soft forecast, revised freely, and must
  never be authored *up to* — termination stays a Mission judgement (unchanged
  "Terminating a Course" rules).
- **A short advisory ADR.** Record the decision that the estimate is display-only
  and must never become a lesson quota (so a future change doesn't "fix" the
  Routine into authoring to the number). ADR 0015 is unchanged and cross-linked.

## Testing Decisions

- **Good tests assert external behavior at the Convex function seam** — not
  internals — in the established style: seed Users/Topics/Lessons/generation rows
  with `t.run`, act as a caller with `withIdentity`, set `PUBLISH_SECRET` in
  `beforeAll`, and assert what each caller can do and see. Prior art:
  `convex/routine.test.ts` (gate/lock + secret-guarded `reportGeneration`) and
  `convex/content.test.ts`.
- **One load-bearing seam: the Convex function API**, exercised via `convexTest`,
  extending `convex/routine.test.ts`:
  - **Write** — `reportGeneration` with `estimatedLessons` set patches
    `topics.estimatedLessons`; called without it, the field is left untouched (a
    later run reporting `nothing`/`failed` doesn't wipe a prior estimate); a bad
    secret is refused (existing pattern).
  - **Read & clamp** — `generationStatus` surfaces the estimate; returns it
    clamped to `max(estimate, publishedCount)` when published Lessons exceed the
    stored guess; returns no estimate while the Topic is `seeded` and once it is
    `completed`; reflects a new value after a subsequent report.
- **No new frontend test** for the rendered `~{n} lessons`, consistent with the
  repo (course-completion / topic-sharing verified reader affordances manually).
  The correctness that matters — what the number is, when it's hidden, and that a
  Viewer can't see it — is enforced and tested at the Convex seam.

## Out of Scope

- **A titled outline / list of upcoming Lessons.** v1 shows a single number only.
- **Per-question attribution** ("+2 from your question", tags, or a callout). The
  estimate rises implicitly; no question→Lesson linkage is stored or shown.
- **Showing the estimate to Viewers, on the public/Certificate pages, or in the
  setup ("Preparing your first lesson") pane.** Owner-only, one surface. _(The
  owner's own dashboard card is now that surface — see Revision; Viewers'
  shared/purchased cards still never show it.)_
- **Instant / real-time update at ask-time.** The estimate refreshes only on
  Routine runs; no in-app LLM call (respects ADR 0001).
- **Any binding on termination or a lesson quota.** ADR 0015 stands; the estimate
  never gates authoring or completion.
- **A "remaining" / countdown framing.** The number is the estimated *total*.
- **"Last updated" / freshness chrome** and **translating the number** (it's a
  numeral, edition-agnostic).

## Further Notes

- This is deliberately tiny: one optional schema field, one optional arg folded
  into an existing mutation + its script flag, one addition to an existing query,
  one line in the reader, two short doc edits, and one short ADR. No new table,
  mutation, CLI, query, route, or UI surface.
- Live Convex queries mean the number updates on its own the moment the Routine
  reports — no extra sync work.
- The estimate first appears after the setup run (~1 min after seeding); before
  that the Topic is `seeded` and nothing is shown.
- Implementation issues live under `issues/` and are dependency-ordered: `01`
  (backend — schema field, report write path, `generationStatus` clamp + read,
  and the Convex-seam tests) then `02` (reader display line + the two agent-
  contract doc edits + the advisory ADR). `01` is the backbone; `02` is
  display + docs on top.
