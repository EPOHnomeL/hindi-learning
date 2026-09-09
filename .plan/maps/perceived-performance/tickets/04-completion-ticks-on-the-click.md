---
type: task
blocked_by: []
---
# Completion ticks on the click, not a beat after the navigation

## Question

There are **68 `useMutation(` call sites in `src/` and zero uses of
`withOptimisticUpdate`** (checked 2026-09-09). Every state change in the app waits for a
server round trip before the UI moves.

Most of those 68 are fine that way: a control with a busy flag and a real refusal message
is the honest shape for a purchase, a voucher redemption or an invite. `useMutationRun`
already gives all of them exactly that, and this ticket must not touch them.

**One is not fine, and it is the single most repeated interaction in the product.**
`completeLesson` (`ArtifactView.tsx:507`) fires `setProgress` fire-and-forget and
navigates. The learner lands on the next lesson, and the tick against the lesson they
just left appears afterwards, in three places at once: the sidebar row, the course
progress indicator, and the dashboard card. The write is not slow; it is simply not
acknowledged until the server says so, so finishing a lesson feels like something that
happened to the app rather than something the learner did.

The fix is a `withOptimisticUpdate` on `setProgress` that patches the local
`capture.myProgress` result. The mutation is already idempotent by shape (a status
transition on a `(topic, user, lessonKey)` tuple) and is already fired without awaiting,
so the optimistic path is close to the behaviour the code already assumes.

Things the resolving session has to decide rather than inherit:

- **Both statuses or just `completed`.** The same mutation writes `opened` on mount
  (`ArtifactView.tsx:492`). That one has no visible consequence to race against, so it
  may want no optimistic update at all. Say which and why.
- **What happens on refusal.** A `preview` caller holds no Progress and the server
  refuses the write. The reader already gates that call on `header.role !== "preview"`,
  so the refusal should be unreachable, but an optimistic update that paints a tick and
  then silently un-paints it is worse than no tick. Establish that the gate genuinely
  covers it.
- **Whether `recordResponse` (quiz answers) wants the same treatment.** It is the obvious
  second candidate, but first-answer-only is enforced server-side, so an optimistic
  answer that the server then rejects is a real case, not a theoretical one. It may
  belong in its own ticket; if so, file it rather than half-doing it here.

This ticket edits the reader, which `technical-foundation/33` records as the
highest-traffic surface in the app with zero component tests. Walk it.

## Done when

- Finishing a lesson ticks it in the sidebar and the course progress indicator on the
  same frame as the click, with the dashboard card correct on arrival.
- A refused or failed write does not leave a false tick on screen.
- Walked in a browser, and the Answer says so explicitly and distinguishes that from
  "verified by reading the code".
- The Answer records the call on `opened` and the call on `recordResponse`, including a
  filed ticket number if the latter is deferred.
