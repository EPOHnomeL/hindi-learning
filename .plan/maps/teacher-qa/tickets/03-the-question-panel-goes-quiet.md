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
