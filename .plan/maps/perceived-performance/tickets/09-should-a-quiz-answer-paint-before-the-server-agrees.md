---
type: grilling
blocked_by: [04]
---
# Should a quiz answer paint before the server agrees?

## Question

Filed 2026-09-09 out of [04](04-completion-ticks-on-the-click.md), which made
`setProgress` optimistic and deliberately did **not** do the same to
`recordResponse`. This is the deferred half, and the reason it was deferred is the
whole question.

`setProgress` was safe to make optimistic because the client can mirror the
server's rule exactly: never downgrade `completed` to `opened`, otherwise write.
Both branches are knowable from data the client already holds, so the optimistic
paint and the server's answer agree by construction. `applyProgress` in
`readerDerive` is that mirror, and it is tested.

**`recordResponse` is not like that.** First-answer-only is enforced server-side,
so whether a given answer counts depends on state the client may not have: a prior
attempt from another device, or from a session this tab never saw. An optimistic
update that marks an answer recorded and is then overruled would flip a quiz
result under the learner after the fact, which is worse than the delay it removes.
Getting a quiz question wrong and watching the app change its mind about it is a
trust problem, not a performance one.

So the questions are:

- **Does the learner actually perceive a delay here at all?** The quiz lives inside
  the sandboxed lesson iframe and the bridge already gives immediate feedback in
  the frame; `recordResponse` is what persists it to Convex. If the visible tick or
  cross is drawn by the iframe's own script, there may be nothing to make
  optimistic and this ticket is a ruling out. **Establish this first**, because it
  probably decides the whole thing: look at what `lessonSrcDoc.ts` injects and at
  what `onResponse` in `ArtifactView` actually changes on screen.
- If there is a real delay: can the client know whether this is a first answer
  without a round trip? A local record of answered quiz ids would cover the
  same-session case, which is most of them, and `useStoredSet` already exists for
  exactly this shape of per-device set.
- What the correct behaviour is when the server does overrule: silently keep the
  server's answer, or tell the learner their earlier attempt is the one that
  counted.

Note the field data from [01](01-field-measurement-for-the-reader.md) may settle
this on its own. INP on the reader is the number that says whether any of this is
felt.

## Done when

Either:

- The ticket is closed with `## Ruled out` recording that the iframe already draws
  the feedback and the Convex write is invisible, with the evidence for that.
- Or a build ticket is filed on this map carrying the agreed rule for a first
  answer and for an overruled one, and this ticket's Answer points at it.
