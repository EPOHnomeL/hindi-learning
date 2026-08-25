# Teacher Q&A: a per-Topic show/hide for the question channel

**Spec-driven effort, not a wayfinder planning map.** The route was already clear after one
`/grill-with-docs` session on 2026-08-25, so this went straight down the pipeline: grill, spec,
tickets, build. The decisions live in [spec.md](spec.md) and the term lives in
[CONTEXT.md](../../../CONTEXT.md) under **Teacher Q&A**. No ADR was raised.

## Destination

A course owner can hide their course's question channel with one switch: the Q&A panel, the owner's
Questions and Replies, the sidebar unread reply dot, and the lesson's green "ask your teacher"
block, all as a single unit. Per **Topic**, owner only, set on the source language tab of the
Editions panel and applying to every **Edition**.

Absence of the setting means **on**, so nothing regresses at deploy and there is no backfill. The
motivating case is YWAM Potchefstroom's `prophetic-school`, a discipleship course whose school does
not want learners forming a relationship with a language model teacher.

Done when tickets 01 to 04 are resolved and the real course has been walked in a browser in both
states.

## Notes

- **These are build tickets, not planning tickets.** Tickets 01 to 04 are tracer-bullet
  implementation slices to be worked with `/implement` and `/tdd`, one per session, clearing context
  between them. Work the frontier: 01 first, then 02 and 03 in parallel, then 04.
- **Filed 2026-08-25** from [spec.md](spec.md). Read the spec before starting any ticket; it carries
  the reasoning that the tickets deliberately omit.
- **Two stale beliefs were corrected during the grilling.** Do not re-derive them, and do not trust
  a memory that contradicts them:
  - The `qa` **tenant feature flag** is **not** a full feature gate. It gates the `askQuestion`
    mutation only, server side, and hides nothing. With it off a learner still sees the ask form and
    gets an error on submit. It is left completely untouched by this effort.
  - The green `.ask` block's "Main source for this week's reading" citation is **redundant** with the
    `<footer>` `Sources` line directly below it, which carries the fuller attribution. Hiding the
    block loses no attribution.
- **Skills per session:** `/implement` with `/tdd` (test first) and a `/ponytail` posture. Use
  `convex:convex-expert` to sanity check anything in `convex/`. `pnpm typecheck` is the cheap whole
  repo verification and needs no dev server. **Never start or stop a dev server**; the user runs
  their own.
- **The single most important assertion in the whole effort:** a Topic that has never had the field
  set must behave exactly as one with it explicitly on. That is what makes this migration free.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- **The setting exists and the owner can flip it** ([01](tickets/01-the-setting-and-its-toggle.md)):
  `topics.teacherQa`, an optional boolean read only through `capture.teacherQaOn` (absence means on,
  in one place); owner-only `capture.setTeacherQa`; a source-tab-only toggle in the Editions dialog.
  The boolean rides **two** bundles the reader already loads: `content.reader.courseHeader` for
  every authed caller and `public.publicCourse` for a Guest. Tickets 02 and 03 consume those and do
  not re-decide. Built 2026-08-25, `2928d46`, verified by tests and by reading the code, not walked.
- **The green ask block disappears from the lesson**
  ([02](tickets/02-the-green-ask-block-disappears.md)): one injected `.ask{display:none}` before
  `</head>`, in both `lessonSrcDoc` builders (the reader's and the owner's in-place editor's), fed
  `teacherQa` off the bundles 01 named. On and unset build byte for byte identically; no stored
  Lesson HTML is touched. Built 2026-08-25, `2e5b977`, verified by tests and by reading the code.
  The browser walk stays with 04.

## Not yet specified

Nothing. The spec closed every question raised in the grilling.

## Out of scope

- **Per Edition Q&A visibility.** Considered and rejected: whether a course offers a question
  channel is a pedagogy choice about the course, not about a language.
- **Hiding Q&A from Guests only** while keeping it for signed in readers. This is the older deferred
  idea recorded in the **Guest** glossary term; Teacher Q&A is all or nothing per Topic and the
  Guest only variant stays unbuilt.
- **Retiring, renaming or fixing the `qa` tenant feature flag**, including its poor experience when
  off, and any change to the admin portal.
- **Deleting existing Questions and Replies.** The setting hides; it never destroys.
- **Making the teach Routine skip authoring the `.ask` block.** It keeps authoring it
  unconditionally, so switching the setting back on restores the block everywhere at once.
- **Any migration, backfill or data rewrite.** There is none, by design.
