---
type: task
blocked_by: [01]
---
# The green ask block disappears from the lesson

## Question

A learner reads a lesson on a course whose owner has turned Teacher Q&A off. The green
"ask your teacher" block at the foot of the lesson is not there. The lesson's `<footer>` and its
source citations are untouched, as are its quizzes, recap and every other component. The owner turns
the setting back on and the block returns on every lesson, including ones authored while it was off.

The block lives inside each **Lesson**'s stored HTML, and Lessons are **immutable**. This ticket
does not rewrite them. Every lesson iframe on every reader path (the owner's reader, the public
reader for a **Guest**, and a paid **Preview**) is built by one function in the lesson source
document module, which already injects conditional CSS for other purposes. Hiding is a rule injected
there. That single seam is why this ticket is small, and it is what keeps the setting instantly
reversible.

The owner's in place lesson editor is built by a **second** function in the same module and must
receive the same treatment, so that what the owner edits matches what a learner sees. Both builders,
not one.

Consume the boolean by the route ticket 01 established. Do not re-decide it.

A concern that looked like a blocker and is not: the block in the motivating course carries a
"Main source for this week's reading" citation as well as the invitation. That citation is redundant
with the `<footer>` `Sources` line directly below it, which carries the fuller attribution. Nothing
is lost. Do not try to preserve half the block.

## Done when

- Both the reader's document builder and the in place editor's document builder accept the setting
  and, when it is off, emit a rule that hides the ask block.
- With the setting on, the output carries no such rule, and behaviour is identical to today.
- The lesson body itself is unchanged in both cases. Assert this directly: it is the immutability
  guarantee, and it is the reason no backfill exists.
- Tests live beside the existing tests for that module, following their prior art for theme,
  direction and injection.
- Walked in a browser on a real lesson: with the setting off there is no green block, with it on the
  block is back, and the footer citation is present either way.
- Both light and dark themes are correct, which they should be for free, since hiding is a display
  rule rather than a colour change.
- No stored Lesson HTML is modified anywhere, and no backfill or migration is written.
- `pnpm typecheck` is green.

## Answer

Built and committed on 2026-08-25 as `2e5b977` (`feat(teacher-qa): hide the lesson ask block when
the setting is off`). Verified by tests and by reading the code; **not walked in a browser**, which
is ticket 04's job (see the correction at the foot of this answer).

**The rule.** `.ask{display:none}`, injected before `</head>` by `injectAskHidden` in
[lessonSrcDoc.ts](../../../../src/app/_components/lessonSrcDoc.ts), on the same before-head rail the
theme, Devanagari, justify and tenant-palette injections already use. head.html styles `.ask` at
(0,1,0) and sets no `display` at all, so a bare selector injected later in the head wins outright:
no `:root:root` doubling, no `!important`. That is the whole change, and it is why the setting is
instantly reversible.

**Both builders, with the same option.** `buildSrcDoc` (every reader path: the owner's reader, the
Guest's public reader, and a paid Preview, which shares the owner reader's component) and
`buildEditDoc` (the owner's in-place editor) each take `teacherQa?: boolean`. Hiding fires only on
an explicit `false`. `true` and absence build **byte for byte** identically, asserted directly with
`toBe`, which is the absence-means-on rule from ticket 01 carried into the render layer.

**Head-only is load-bearing for the editor.** `buildEditDoc`'s document is read back on save through
`replaceBodyInner`, which takes `body.innerHTML`. A rule injected into the body would be written
into the immutable Lesson on the owner's next save. There is a test asserting nothing after `<body`
contains `display:none`.

**Wiring, off the bundles ticket 01 named. No new query anywhere.**

- `LessonView` already subscribes to `content.reader.courseHeader` for the caller's role, so
  `header?.teacherQa` was already in scope; it now feeds both the `<Frame>` and the `<ContentEditor>`.
- `PublicReader` passes `course.teacherQa` off the `public.publicCourse` bundle.
- `Frame` and `ContentEditor` each gained one optional prop, threaded into their `useMemo` deps.
- References were deliberately left alone: they carry no `.ask` block.

**A flash-on that was checked and is not there.** `teacherQa` is in the srcDoc memo's deps, so a
late-arriving header would rebuild the iframe. It cannot arrive late: the Frame renders only once
`html` is a string, and `useContentHtml` starts its `fetch` only *after* the Convex query resolves,
so `courseHeader` is always settled first. This is the same argument the tenant-palette comment
already relies on, and `tenantPalette` sits in the same deps array.

**Tests** (`lessonSrcDoc.test.ts`, seven new cases across both builders, following the file's prior
art for theme, direction and injection): the rule lands inside `<head>`; on and unset are byte
identical; the stored body survives verbatim, ask block and footer citation both; light and dark are
covered by one loop, since display is not a colour; and the editor's body read-back stays clean. A
`buildEditDoc` describe block is new to the file, which had none.

**Nothing was rewritten.** No stored Lesson HTML is touched, no migration, no backfill, and the
teach Routine still authors the block unconditionally.

`pnpm typecheck` green; full suite 944 tests green (937 before, plus these seven), no fixture churn.

**A correction to this ticket's own Done-when.** It asks for a browser walk, and no dev server was
listening on port 3000 during this session; per CLAUDE.md a server is never started here. That walk
is not left dangling: **[Walk the prophetic school with Teacher Q&A off](04-walk-the-prophetic-school.md)**
already exists, is `blocked_by: [02, 03]`, and names the green block explicitly among the things to
look at, in both themes and both widths. No new ticket was filed, because filing one would duplicate
04.
