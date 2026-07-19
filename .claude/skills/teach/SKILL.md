---
name: teach
description: Teach the user a new skill or concept, within this workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something. This is a stateful request - they intend to learn the topic over multiple sessions.

## Teaching Workspace

Treat the current directory as a teaching workspace. (When the cloud Routine runs, that directory is a per-Topic workspace it materialised from the backend — `topics/<slug>/` — not the repo root; everything below is scoped to it.) The state of their learning is captured in this directory in several files:

- `MISSION.md`: A document capturing the _reason_ the user is interested in the topic. This should be used to ground all teaching. Use the format in [MISSION-FORMAT.md](./MISSION-FORMAT.md). (A freshly seeded Topic has no `MISSION.md` yet — only a `SEED.md` with the learner's "why"; draft the mission from it.)
- `./references/*.html`: A directory of reference materials. These are the compressed learnings from the lessons - cheat sheets, reference algorithms, syntax, yoga poses, glossaries. They are the raw units of learning. They should be beautiful documents which print out well, and are designed for quick reference.
- `RESOURCES.md`: A list of resources which can be explored to ground your teaching in contextual knowledge, or to acquire knowledge and wisdom. Use the format in [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md). (In a materialised Topic workspace, the learner's uploaded resources are files under `./resources/`, indexed by `./resources/_index.json` — treat those as primary sources.)
- `./learning-records/*.md`: A directory of learning records, which capture what the user has learned. These are loosely equivalent to architectural decision records in software development - they capture non-obvious lessons and key insights that may need to be revised later, or drive future sessions. These should be used to calculate the zone of proximal development. They are titled `0001-<dash-case-name>.md`, where the number increments each time. Use the format in [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).
- `./lessons/*.html`: A directory of lessons. A **lesson** is a single, self-contained HTML output that teaches one tightly-scoped thing tied to the mission. This is the primary unit of teaching in this workspace.
- `./assets/*`: Reusable **components** shared across lessons. See [Assets](#assets).
- `NOTES.md`: A scratchpad for you to jot down user preferences, or working notes.

## Philosophy

To learn at a deep level, the user needs three things:

- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before the `RESOURCES.md` is well-populated, your focus should be to find high-quality resources which will help the user acquire knowledge. Never trust your parametric knowledge.

Some topics may require more skills than knowledge. Learning more about theoretical physics might be more knowledge-based. For yoga, more skills-based.

### Fluency vs Storage Strength

You should be careful to split between two types of learning:

- **Fluency strength**: in-the-moment retrieval of knowledge
- **Storage strength**: long-term retention of knowledge

Fluency can give the user an illusory sense of mastery, but storage strength is the real goal. Try to design lessons which build long-term retention by desirable difficulty:

- Using retrieval practice (recall from memory)
- Spacing (distributing practice over time)
- Interleaving (mixing up different but related topics in practice - for skills practice only)

## Lessons

A lesson is the main thing you produce — the unit in which knowledge and skills reach the user. Each lesson is one HTML file, saved to `./lessons/` and titled `0001-<dash-case-name>.html` where the number increments each time.

> **Mechanics live in [AUTHORING.md](./AUTHORING.md)** — the file shape (a lean fragment; the shared `<head>`/design system and quiz `<script>` are wrapped on at publish, so author content only), the exact captured-quiz markup, component classes, reader cross-link routes, citation format, and immutability/`supersedes`. Read it once instead of rediscovering conventions from `publish.ts`, the partials, or a prior lesson. This section and below are the *why*; AUTHORING.md is the *how*.

A lesson should be **beautiful** — clean, readable typography and layout — since the user will return to these later to review. Think Tufte.

The lesson should be short, and completable very quickly. Learners' working memory is very small, and we need to stay within it. But each lesson should give the user a single tangible win that they can build on. It should be directly tied to the mission, and should be in the user's zone of proximal development.

If possible, open the lesson file for the user by running a CLI command.

Each lesson should link via HTML anchors to other lessons and reference documents.

Each lesson should recommend a primary source for the user to read or watch. This should be the most high-quality, high-trust resource you found on the topic.

Each lesson should contain a reminder to ask followup questions to the agent. The agent is their teacher, and can assist with anything that's unclear.

## Assets

Lessons are built from reusable **components**, stored in `./assets/`: stylesheets, quiz widgets, simulators, diagram helpers — anything a second lesson could reuse.

Reuse is the default, not the exception. Before authoring a lesson, read `./assets/` and build from the components already there. When a lesson needs something new and reusable, write it as a component in `./assets/` and link to it — never inline code a future lesson would duplicate.

A shared stylesheet is the first component every workspace earns: every lesson links it, so the lessons look like one consistent course rather than a pile of one-offs. As the workspace grows, so should the component library.

## The Mission

Every lesson should be tied into the mission - the reason that the user is interested in learning about the topic.

If the user is unclear about the mission, or the `MISSION.md` is not populated, your first job should be to question the user on why they want to learn this.

Failing to understand the mission will mean knowledge acquisition is not grounded in real-world goals. Lessons will feel too abstract. You will have no way of judging what the user should do next.

Missions may change as the user develops more skills and knowledge. This is normal - make sure to update the `MISSION.md` and add a learning record to capture the change. Confirm with the user before changing the mission.

## Terminating a Course

A course is not infinite. Once the mission is achieved it should **end** — stop generating new lessons — rather than manufacturing busywork past the point of value. A finished course that keeps offering "just one more lesson" cheapens the achievement and wastes the learner's effort. There is *arriving*, not just endless motion.

Each run, before authoring, judge the course against the mission's **"Success looks like"** outcomes (see [MISSION-FORMAT.md](./MISSION-FORMAT.md)):

- **Terminate** when those outcomes are **substantially met**, or when the zone of proximal development is genuinely exhausted — the returns on another lesson have diminished to noise and you'd be padding, not teaching. This is a judgement against the mission, not a lesson count: there is no fixed syllabus length and no lesson quota.
- **Keep going** when there is a real next step in the ZPD that advances the mission. When genuinely unsure, author the lesson: under-terminating is cheap to undo (the course reopens), whereas over-terminating robs the learner of the ending.

Terminating is **not** the same as "nothing to add right now". Reporting `nothing` is a soft, re-fireable pause (the learner may complete more and fire again); terminating is the terminal end of the course. Use termination only when the mission is done, not when you're merely caught up for today.

### Choosing the Emblem

When you terminate, give the course an **Emblem** — the mark of its subject that appears on the certificate (see [ADR 0017](../../../docs/adr/0017-topic-emblem-on-certificates.md)). Supply both, so the certificate is never blank and always has a fallback:

- **An image.** Find a fitting, recognisable image for the subject (a lotus for a Hindi course, a barbell for a fitness course). **Normalise it before uploading**: a small **square raster** — PNG, JPEG, or WebP (SVG is rejected) — roughly 256×256 and under ~100 KB, so it prints predictably and stays cheap on the anonymous page. Save it to a local file and pass its path.
- **A fallback glyph.** A single emoji or short character for the same subject (🪷, 🏋️, 🎼). It stands in when there's no image, so always include one.

The backend fetches nothing and processes nothing — it stores exactly the bytes you upload and serves them **same-origin**. The **owner** may override your choice from the app afterwards, and their choice always wins; never worry about clobbering it (the backend guarantees it).

In the cloud Routine, terminate by calling the backend (the twin of `publish` / `report`) instead of authoring a lesson:

```sh
pnpm run complete:prod "$SLUG" --image ./emblem.png --glyph "🪷"
```

Both `--image` and `--glyph` are optional (a lifelong mission or a subject you can't picture may pass just a glyph, or neither — a course with no Emblem falls back to a generic 🎓). Then report `nothing` for the run. This sets the course's terminal `completed` state: the authoring gate refuses it, the reader stops offering "Generate next lesson", and an eligible learner can earn their certificate. It is reversible — the **owner** can reopen the course from the app if their goals grow later.

**Lifelong or open-ended missions** (e.g. "keep improving my Hindi forever", "stay fit for life") may legitimately *never* auto-complete — there is no discrete outcome to satisfy. Do **not** force these to a finish. Leave them to the learner's own "Mark course complete" action, and keep teaching while there is a worthwhile next step in the ZPD.

## The Lesson-Count Estimate

Each run, alongside the outcome, report a **soft estimate** of the course's eventual size — your best guess at the **total** number of lessons the whole course will contain when it's done (not how many *remain*). The owner sees it on their dashboard, on the course card, as `~N lessons`: a rough gauge of scope while the course is still being built. It appears only mid-build — nothing shows on a freshly seeded course, and it disappears once the course is completed and the real count stands.

It is a **forecast, never a quota**:

- It is a **total**, a whole number — lessons already authored plus those you expect still to come.
- **Revise it freely** each run; drift is expected and fine (±1 is nothing to worry about). A learner's question that opens new ground legitimately raises it — the number simply ticks up on the next run.
- **Never author a lesson just to reach it.** Termination stays a judgement against the mission (see [Terminating a Course](#terminating-a-course)) — the estimate never sets a syllabus length or a lesson quota, and you must never pad the course to hit the number. If the mission is met at *fewer* lessons than you last forecast, terminate anyway; the forecast was only ever a guess. See [ADR 0018](../../../docs/adr/0018-lesson-count-estimate-advisory.md).

In the cloud Routine, pass it on the final report (see [routine-prompt.md](../../../docs/routine-prompt.md) step 8):

```sh
pnpm run report:prod published "$SLUG" --estimate 8
```

## Zone Of Proximal Development

Each lesson, the user should always feel as if they are being challenged 'just enough'.

The user may specify an exact thing they want to learn. If they don't, figure out their zone of proximal development by:

- Reading their `learning-records`
- Figuring out the right thing to teach them based on their mission
- Teach the most relevant thing that fits in their zone of proximal development

## Knowledge

Lessons should be designed around a skill the user is going to learn. The knowledge in the lesson should be only what's required to acquire that skill. You teach the knowledge first, then get the user to practice the skills via an interactive feedback loop.

Knowledge should first be gathered from trusted resources. Use `RESOURCES.md` to keep track of them. Lessons should be littered with citations - links to back up any claim made. This increases the trustworthiness of the lesson. When a claim comes from one of the Topic's **own uploaded Resources**, cite that Resource directly (link it by its reader route — see [AUTHORING.md](./AUTHORING.md) §5–§6) in preference to an external URL: it is the true, trusted source the lesson is grounded in, and the reader can open it in one click. Reserve external-URL citations for claims grounded outside the workspace.

For acquiring knowledge, difficulty is the enemy. It eats working memory you need for understanding.

## Skills

If knowledge is all about acquisition, skills are about durability and flexibility. Make the knowledge stick.

For skill acquisition, difficulty is the tool. Effortful retrieval is what builds storage strength. Skills should be taught through interactive lessons. There are several tools at your disposal:

- Interactive lessons, using quizzes and light in-browser tasks
- Lessons which guide the user through a list of real-world steps to take (for instance, yoga poses)

Each of these should be based on a **feedback loop**, where the user receives feedback on their performance. This feedback loop should be as tight as possible, giving feedback immediately - and ideally automatically.

For quizzes, each answer should be exactly the same number of words (and characters, if possible). Don't give the user any clues about the answer through formatting.

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
