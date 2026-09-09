---
type: task
blocked_by: [27]
---
# One Reader Course module, two adapters

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 9), re-verified in
the tree on 2026-09-07.

Answering "what does this reader know about the current Lesson?" currently means reading
six live subscriptions in `CourseShell.tsx` (`:82`, `:103-106`, `:445`), an eight-member
context (`:195-206`), a prop-forwarding pane, and then **five re-issued copies of the same
queries inside `ArtifactView.tsx`** (`:424-445`). The Guest reader answers the identical
question from one bundle under different field names, so the same fact has two spellings:
`header.teacherQa` and `course.teacherQa`.

Three things are written twice as a result:

- resume-else-first: `CourseShell.tsx:174-176` against `PublicReader.tsx:132-134`
- the next-row lookup: `ArtifactView.tsx:455` against `PublicReader.tsx:436-437`
- the paygate wiring: `ArtifactView.tsx:501-513,968-980` against
  `PublicReader.tsx:344-355,498-509`

**The server side already did this deepening** (`convex/content/reader.ts:245` is the
shared core), so only the client is un-deepened.

## The derive-pattern verdict this ticket depends on

`readerDerive.ts` got drawn at the largest expression that happened to be pure, rather
than where the behaviour lives, because there is no way to test a component here (see
[32](32-one-mutation-run-module.md): 0 `.test.tsx` files). The visible cost, verified
2026-09-07:

- `unseenReplyKeys` (`readerDerive.ts:73`) has three passing tests in
  `readerDerive.test.ts:283-303` and **zero production callers**.
- `NavItem.notify` is declared (`NavItem.tsx:17,25`) and never passed by either reader.
- `CourseShell.tsx:111-169` still loads and persists a seen set for a dot nothing renders.

Meanwhile the composition that *does* run is duplicated across the two readers and
untested.

**The fix is not to delete `readerDerive`.** It is to move the duplicated composition in
and shrink the interface: one `readerNav(lessons, progress, currentKey)` answering first,
frontier, resume, start, next, nextRow and completed, with the twelve one-line exports
becoming private. `priceDerive.ts` and `manage/dashboardDerive.ts` are the pattern done
right and are the model, not the target.

## Done when

One `useReaderCourse()` returns the whole Edition-scoped answer, with an authed adapter
(`content.reader.*` plus `capture.*`) and a token adapter (`api.public.*`) behind it.
`CourseShell` and `PublicCourseShell` become chrome over the same rows, the panes read one
module, and `ArtifactView` re-subscribes nothing. The dead seen-set machinery and the
callerless derive exports go with it, or a reason to keep them is recorded.

`pnpm typecheck` and `pnpm test` green.

**Blocked by [27](27-iframe-bridge-as-one-source-checked-module.md).** This ticket's
target shape has `ArtifactView` reduced to a frame plus editor plus question box owning no
queries, and that frame (owning one source-checked listener and taking handlers as part of
its interface) is what 27 builds. Doing this first means moving four listeners into a
shape 27 then re-cuts.

**ADR 0012 is stale and needs a superseding ADR, not an edit.** It decided that the course
layout hosts a small course-scoped context owning the seen set for notification dots. The
dots no longer exist. The URL-addressability decision itself is untouched by this ticket,
so the superseding ADR should be narrow and say so.

**Part of this landed on 2026-09-08, and the ticket stays open.** No `## Answer`,
because the `## Done when` above is not met.

What landed (commit `refactor(reader): delete the notification-dot machinery nothing
rendered`), which is this ticket's "the dead seen-set machinery and the callerless derive
exports go with it, or a reason to keep them is recorded":

- `unseenReplyKeys` deleted, with its three tests. It had **zero production callers**.
- `NavItem`'s `notify` prop and the dot it rendered deleted. It was **never passed by
  either reader**.
- The `hindi:answers-seen` set, `markSeen`, `seenAfterOpening` and `LessonPane`'s
  mark-on-open effect deleted. The only thing that ever read the key back was the
  sign-out sweep's own test.
- **`myQuestions` came out of `CourseShell` with it**, because the seen set was its only
  consumer. So the shell is down one of the six live subscriptions this ticket counts, and
  the context is down one member.
- `docs/adr/0036` supersedes ADR 0012 in part, which is the superseding ADR this ticket
  asked for rather than an edit. It is narrow and says so: URL-addressability, the
  layout/page split and the live-`useQuery` posture are untouched. It also records what is
  NOT decided, namely whether the product wants reply dots at all.

**What remains, and why it was not attempted in the same session:** the one
`useReaderCourse()` with an authed and a Guest adapter, `ArtifactView` re-subscribing
nothing, `CourseShell`/`PublicCourseShell` reduced to chrome, and the three duplicated
compositions (resume-else-first, the next-row lookup, the paygate wiring) folded into
`readerNav`. That is the highest-traffic surface in the product with **zero component
tests**, so a regression there is invisible to the suite and lands on every learner. It
wants its own session and a browser walk, not the tail of a long one.

Note the line numbers in the Question above have drifted: they were measured 2026-09-07
and this file changed on 2026-09-08. Re-measure before acting on them.
