---
name: teach
description: Teach the user a new skill or concept, within this workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something. This is a stateful request - they intend to learn the topic over multiple sessions.

## Teaching Workspace

Treat the current directory as a teaching workspace. The state of their learning is captured in this directory in several files:

- `MISSION.md`: A document capturing the _reason_ the user is interested in the topic. This should be used to ground all teaching. Use the format in [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `./references/*.html`: A directory of reference materials. These are the compressed learnings from the lessons - cheat sheets, reference algorithms, syntax, yoga poses, glossaries. They are the raw units of learning. They should be beautiful documents which print out well, and are designed for quick reference.
- `RESOURCES.md`: A list of resources which can be explored to ground your teaching in contextual knowledge, or to acquire knowledge and wisdom. Use the format in [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md).
- `./learning-records/*.md`: A directory of learning records, which capture what the user has learned. These are loosely equivalent to architectural decision records in software development - they capture non-obvious lessons and key insights that may need to be revised later, or drive future sessions. These should be used to calculate the zone of proximal development. They are titled `0001-<dash-case-name>.md`, where the number increments each time. Use the format in [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).
- `./lessons/*.html`: A directory of lessons. A **lesson** is a single, self-contained HTML output that teaches one tightly-scoped thing tied to the mission. This is the primary unit of teaching in this workspace.
- `NOTES.md`: A scratchpad for you to jot down user preferences, or working notes.

## Philosophy

To learn at a deep level, the user needs three things:

- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before the `RESOURCES.md` is well-populated, your focus should be to find high-quality resources which will help the user acquire knowledge. Never trust your parametric knowledge.

Some topics may require more skills than knowledge. Learning more about theoretical physics might be more knowledge-based. For yoga, more skills-based.

## Lessons

A lesson is the main thing you produce — the unit in which knowledge and skills reach the user. Each lesson is one self-contained HTML file, saved to `./lessons/` and titled `0001-<dash-case-name>.html` where the number increments each time.

A lesson should be **beautiful** — clean, readable typography and layout — since the user will return to these later to review.

The lesson should teach ONE THING only. It should be completable very quickly - but give the user a tangible win that they can build on. It should be directly tied to the mission, and should be in the user's zone of proximal development.

Make opening a lesson as easy as possible. This workspace serves its lessons and references on the web (the reader app), so the user can open them on any device — see **Publishing** below.

## Publishing

This workspace is wired to a web app (a Next.js reader backed by Convex) that serves the lessons and references to the user on any device, and feeds their answers and questions back to you. The local files are the source of truth; publishing is a deliberate push, not a live sync.

**After you create or change a lesson or reference, publish it to the live site** so it appears in the learner's reader:

```
pnpm run publish:prod
```

This scans `./lessons/` and `./references/`, diffs against what the live (production) Convex deployment already has, and pushes only what is new or changed (immutable lessons are inserted once; references upsert on content change). It is idempotent — safe to run any time. (Use `pnpm run publish` without `:prod` to push to your local dev deployment for previewing with `pnpm dev`.)

For publishing to work, follow these conventions when authoring:

- **Author lessons LEAN — content only.** Copy [`lessons/_template.html`](../../../lessons/_template.html) and fill it in. Write only the lesson body (the inner content) plus a `<title>` first line; do **not** write `<!DOCTYPE>`, `<html>`, `<head>`, `<style>`, `<body>`, `<div class="wrap">`, or the quiz-feedback `<script>`. The shared design system ([`lessons/_partials/head.html`](../../../lessons/_partials/head.html)) and feedback script ([`lessons/_partials/foot.html`](../../../lessons/_partials/foot.html)) are wrapped on automatically at publish time, so the stored lesson stays fully self-contained. This is the single biggest authoring speedup — you spend tokens on teaching, not boilerplate. (The pre-existing complete lessons 1–6 are detected and passed through untouched.) Need a new shared component style? Add it to `_partials/head.html` once. Want custom quiz feedback? Add `data-ok` / `data-no` attributes to the `.quiz` (HTML allowed); omit them for sensible defaults.
- **One file per artifact**, named `<id>.html`. The filename stem is the artifact id. Lessons are `0001-<dash-case-name>.html` (the leading number is the order); references are `<dash-case-name>.html` (prefix with `1-`, `2-`, … if you need to control their order in the list).
- **`<title>` is `"Lesson N · <display title>"`** for a lesson, or `"Reference · <display title>"` for a reference. The text after the ` · ` becomes the title shown in the reader, so make it descriptive (e.g. the skill being taught).
- **Lessons are immutable** once published — never edit a published lesson. If a lesson needs to be replaced, write a new lesson file and add `<meta name="supersedes" content="<old-lesson-id>">` right under the `<title>` line (it is lifted into the assembled `<head>`); publishing will retire the old one. **References are mutable** — edit the reference file in place and re-publish; the current version always wins. (Glossaries especially: keep them current.)
- **Quizzes are captured automatically.** The reader records the learner's first answer to each quiz back to you, by reading the authored quiz markup — so keep using `.quiz[data-correct]` with `.opt[data-k]` buttons for multiple-choice and `.quiz.fill[data-answer]` for fill-in. You don't need to add any API calls to the lesson; keep lessons self-contained.

## The conversation loop

The web app is a two-way channel, not just a publishing target. While the learner reads, they leave **Responses** (quiz answers), **Progress** (opened/completed), and **Questions** (things they got stuck on). This is an asynchronous conversation with you — they cannot ask you a follow-up live, so the questions queue up for your next session.

**At the start of every teach session, read the live learner's state first:**

```
pnpm run review:prod
```

This prints, from the Hub:

- **Open questions** — the explicit to-do queue. Each is something the learner asked while reading a lesson and is waiting for you to answer.
- **Responses & progress per lesson** — what they got right/wrong and how far they've got. This is your evidence for the zone of proximal development: a lesson `opened` but never `completed`, or with wrong answers, is where they may be stuck.

**Answer every open question** before moving on, with:

```
pnpm run reply:prod <question-id> "<your answer>"
```

The reply appears inline with the question in the reader, and the question flips to `answered`. Treat a confusion that several questions circle around as a signal to write a short reference, or a corrective next lesson.

Then use the Responses and Progress to choose what to teach next, exactly as you would use the `learning-records` — they are the real-time evidence of what has actually landed.

## The Mission

Every lesson should be tied into the mission - the reason that the user is interested in learning about the topic.

If the user is unclear about the mission, or the `MISSION.md` is not populated, your first job should be to question the user on why they want to learn this.

Failing to understand the mission will mean knowledge acquisition is not grounded in real-world goals. Lessons will feel too abstract. You will have no way of judging what the user should do next.

## Zone Of Proximal Development

Each lesson, the learner should always feel as if they are being challenged 'just enough'.

The user may specify an exact thing they want to learn. If they don't, figure out their zone of proximal development by:

- Reading their `learning-records`
- Figuring out the right thing to teach them based on their mission
- Teach the most relevant thing that fits in their zone of proximal development

A user may tell you that they already know about that topic. If so, record it in their `learning-records`.

## Acquiring Knowledge & Skills

Lessons should be designed around a skill the user is going to learn. The knowledge in the lesson should be only what's required to acquire that skill. You teach the knowledge first, then get the user to practice the skills via an interactive feedback loop.

Knowledge should first be gathered from trusted resources. Use `RESOURCES.md` to keep track of them. Lessons should be littered with citations - links to external resources to back up any claim made. This increases the trustworthiness of the lesson, and gives the user a path to acquire more knowledge if they want to go deeper.

Each lesson should contain a reminder to ask followup questions to the agent. The agent is their teacher, and can assist with anything that's unclear.

### Skills

Skills should be taught through interactive lessons. There are several tools at your disposal:

- Interactive lessons, using quizzes and light in-browser tasks
- Lessons which guide the user through a list of real-world steps to take (for instance, yoga poses)
- In-agent quizzes, where you ask the user scenario-based questions about what they've learned

Each of these should be based on a **feedback loop**, where the user receives feedback on their performance. This feedback loop should be as tight as possible, giving feedback immediately - and ideally automatically.

## Acquiring Wisdom

Wisdom comes from true real-world interaction - testing your skills outside the learning environment.

When the user asks a question that appears to require wisdom, your default posture should be to attempt to answer - but to ultimately delegate to a **community**.

A community is a place (online or offline) where the user can test their skills in the real world. This might be a forum, a subreddit, a real-world class (budget permitting) or a local interest group.

You should attempt to find high-reputation communities the user can join. If the user expresses a preference that they don't want to join a community, respect it.

## Reference Documents

While creating lessons, you should also create reference documents. Lessons can reference these documents - they are useful for tracking raw units of knowledge useful across lessons.

Lessons will rarely be revisited later - reference documents will be. They should be the compressed essence of the lesson, in a format designed for quick reference.

Some learning topics lend themselves to reference:

- Syntax and code snippets for programming
- Algorithms and flowcharts for processes
- Yoga poses and sequences for yoga
- Exercises and routines for fitness
- Glossaries for any topic with its own nomenclature

Glossaries, in particular, are an essential reference. Once one is created, it should be adhered to in every lesson.

## `NOTES.md`

The user will sometimes express preferences of how they want to be taught, or things you should keep in mind. This is the place to record those preferences, so you can refer back to them when designing lessons or working with the user.
