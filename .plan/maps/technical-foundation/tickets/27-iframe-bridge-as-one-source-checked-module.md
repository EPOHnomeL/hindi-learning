---
type: task
blocked_by: []
---
# The iframe bridge as one source-checked module

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 3), re-verified in
the tree on 2026-09-07.

Half the lesson-iframe protocol lives in `src/app/_components/lessonSrcDoc.ts` as typed
builders. The other half is **four independent `window` message listeners** inside
`ArtifactView.tsx`, each casting `e.data` inline:

| listener | installed | `e.source` checked |
|---|---|---|
| share card | `:275` | yes, at `:242` |
| height | `:304` | **no** |
| navigate | `:344` | yes, at `:314` |
| response | `:485` | **no** |

The response listener at `:485` reads `e.data` raw and calls `recordResponse` off it, so
**any other frame on the page can post a fake `response` message and have a Response
recorded against the open Lesson**. Both outbound `postMessage` calls (`:224`, `:283`)
target `"*"`. `lessonSrcDoc.test.ts` covers string assembly only, so the protocol itself
has never been tested.

## Done when

The whole protocol is one module: a typed message union in both directions, a
`listenToFrame(win, handlers)` that installs **one** source-checked listener, and the
outbound `post`. The component that renders the frame is its only caller and takes the
handlers as part of its interface; `LessonView` stops owning a listener. The spoofing
path is closed for `height` and `response`, and that closure is demonstrated by a test
that fails without the guard, the bar [23](23-tenant-token-mirror-has-no-test.md) was
held to.

`pnpm typecheck` and `pnpm test` green.

**Satisfies ADR 0011, does not contradict it.** ADR 0011 requires exactly this
postMessage seam for app-driven theming; naming it as a module is what the ADR assumed
already existed.

**Tension with [02](02-lesson-quiz-architecture.md), deliberately not made a blocking
edge.** 02 decides whether the quiz comes out of the iframe at all, and if it does, the
`response` message eventually disappears. This ticket is **not** blocked on that, because
the unguarded write path is live now and the guard is worth having for however long the
message exists. If 02 resolves first, fold its answer in; if this resolves first, 02
inherits a protocol it can delete cleanly.

**A shipping caller omits it entirely.** The review notes the Guest reader panes never
install the response listener, so a Guest posts into nothing. Confirm whether that is
intended (Guests record no Responses) or a second gap, and say which in the Answer.

**Note for whoever also takes [33](33-one-reader-course-module.md):** 33 restructures
`ArtifactView` around a frame component that owns no queries. That component is this
ticket's product, which is why 33 is `blocked_by` this one.
