---
type: task
blocked_by: [01]
---
# The Q&A panel, the sidebar dots and the guest payload all go quiet

## Question

On a course with Teacher Q&A off, nobody sees the question channel. A learner on desktop gets no
right hand Q&A column and the lesson takes the full reading width. On a phone there is no inline
Q&A block under the lesson, which now ends at its footer. No lesson in the sidebar carries an unread
reply dot, and no "New reply from your teacher" indicator appears anywhere. A **Viewer** of a shared
Edition sees no read only Questions and Replies panel, a **Guest** on a **Public link** sees none
either, and a buyer looking at a paid **Preview** sees none.

The **[[Question]]s** and **[[Reply|Replies]]** already stored are not deleted. Turning the setting
back on restores the conversation exactly as it was.

The withholding happens **on the server**, not in the client. This is a deliberate departure from
the tenant feature flag helper's documented rule that flags never gate read paths, and the reason is
that a **Guest**'s course bundle carries the owner's Q&A over the wire, so a client side hide would
leave it readable in devtools. Leave a comment at each gated site saying so, and cross reference the
**Teacher Q&A** glossary term, so a later session does not "fix" it back.

One economy worth knowing before starting: the Q&A panel and the sidebar unread reply dots read the
**same** query. Emptying that one query silences the panel's content, the dots and the reply
indicator together, with no separate suppression logic. The guest course bundle is a second,
unavoidable read path and needs its own gate.

The reader still branches on the boolean from ticket 01, not on the list being empty: an owner who
has never asked anything also has an empty list and must still see the ask form.

Leave the `qa` tenant feature flag alone. It keeps refusing the asking; this ticket decides the
showing.

## Done when

- The owner's questions query returns an empty list when the Topic has the setting off.
- The guest course bundle omits the owner's questions when it is off, so they are absent from the
  network payload rather than hidden in the DOM.
- The reader renders no desktop Q&A column, no mobile inline block, and no read only Viewer or Guest
  panel when it is off, branching on the boolean rather than on list emptiness.
- No unread reply dot and no reply indicator appear when it is off.
- An owner with the setting **on** and no questions yet still sees the ask form. This is the case
  that proves the branch is on the boolean and not on emptiness.
- Stored Questions and Replies are untouched, and switching the setting back on restores them
  intact, with a test.
- Covered for each caller that can reach the Q&A: owner, Viewer, Guest, and paid Preview.
- Tests follow the prior art for the guest bundle's shape, for per Edition reading, and for a gate
  that both allows and denies.
- A comment at each gated site records why this one gates the read path, referencing the glossary
  term.
- `pnpm typecheck` is green and the Convex suite passes.

## Answer

Built and committed on 2026-08-25 as `78963a7` (`feat(teacher-qa): withhold the question channel
when the setting is off`). Verified by the Convex suite and by reading the code; **not walked in a
browser**, which is ticket 04's job.

**Two server gates, both reading `teacherQaOn` from ticket 01.**

- `capture.myQuestions` returns `[]` when the Topic has the setting off, right after
  `getViewableTopic` resolves the Topic and before any `questions` read. That one query is what the
  desktop panel, the mobile block and (were it wired, see below) the sidebar dot all subscribe to.
- `public.publicCourse` computes `qaOn` once and uses it twice: the owner's thread is not built at
  all when it is off, and the same value is what the bundle already returned as `teacherQa`. The
  paid Preview case needed nothing new, since `questions: preview ? [] : questions` was already
  withholding Q&A from a Preview Guest.

Both sites carry a comment naming the departure from `assertTenantFlag`'s rule that a flag never
gates a read, giving the reason (the Guest bundle ships the owner's Q&A over the wire, so a client
side hide leaves it readable in devtools), pointing at each other as twin gates, and asking not to
have it "fixed" back. Both cross reference the **Teacher Q&A** glossary term.

**Four client branches, all on the boolean.** `ArtifactView`'s lesson pane gains
`const teacherQa = header?.teacherQa !== false` beside its existing `preview`, gating the mobile
inline `QuestionBox` and the desktop `<aside>` column, so the lesson takes the full reading width.
`PublicReader`'s `PublicLessonPane` gains the same from `course.teacherQa`, gating both
`GuestQuestions` sites. A loading header reads as **on**, matching the toggle and the injected
`.ask` rule from ticket 02, so a course with an open channel never flashes shut.

**The authed paid Preview needed no new gate either**, and this is worth knowing: a Preview only
caller holds no grant, so `getViewableTopic` already returns null for them and `myQuestions` was
always `[]`. The UI's `!preview` branch is what removes the panel.

**The sidebar unread reply dot and the "New reply from your teacher" indicator do not exist.** They
were unwired on 2026-07-09 by `1d05eb7` ("remove unused unseenAnswers logic from CourseShell"):
`NavItem` still accepts a `notify` prop, `readerDerive` still exports `unseenReplyKeys` (used only
by its own test), and `CourseShell` still keeps the per-device `seen` set and `markSeen`, but no
caller passes `notify`, so **no dot renders on any course in any state**. This ticket's Done-when
("no unread reply dot appears when it is off") therefore holds without a line of code, and nothing
was wired up to make it interesting: a dot that appears only when Teacher Q&A is off is not a
feature. The spec's "one query change silences three surfaces" is right about the mechanism and
wrong about the count, and a dated correction now says so in [spec.md](../spec.md); the day someone
rewires the dot it will read the empty list and stay dark, with no extra suppression logic.

**Tests** (five new, following the prior art the ticket named). In `capture.test.ts`: the owner's
query goes empty with the setting off and returns the same Question intact when flipped back on; a
Viewer of a shared Edition reads `[]` when it is off; an owner with it **on** and nothing asked
gets `[]` while the bundle still says `teacherQa: true`, which is the pair that proves the reader
cannot branch on emptiness; and the gate is per Topic, so a sibling course keeps its Q&A. In
`public.test.ts`, following `publicCourse`'s full-mirror test: the Guest payload carries the thread
when on, carries `questions: []` with `teacherQa: false` when off with the lessons TOC untouched,
the rows are still in the table, and switching back on restores them. One stale comment on ticket
01's "stored Questions survive" test was corrected, since hiding now exists.

**Untouched, as required:** the `qa` tenant feature flag, `assertTenantFlag`, `askQuestion`'s gate,
the admin portal, and every stored Question and Reply.

`pnpm typecheck` green; full suite 949 tests green.
