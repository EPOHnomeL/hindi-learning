---
type: task
blocked_by: []
---
# The reader drawer moves on a spring, in both readers

> `/wayfinder .plan/maps/fluid-interface/tickets/03-the-drawer-on-a-spring.md`

## Question

`CourseShell.tsx:245` tracks the handle 1:1 with pointer capture, which is
right. On release it drops back to `transition-transform duration-300`, a fixed
ease regardless of finger speed. Commit is decided by distance
(`drawerDrag.ts:19`), not velocity; upward drag is clamped to zero instead of
rubber-banding; a re-grab mid-close snaps to zero rather than picking up the
live transform. `PublicReader.tsx:183` still draws a handle with no handlers.

Build a small spring helper (`spring.ts`: critically damped, retargetable,
starts from the current value and velocity, honours reduced motion by jumping)
and drive both drawers with it: open and close along the same path, release
velocity handed to the spring, commit decided by velocity sign then position,
rubber-band above rest, scrim opacity tied to the sheet's position rather than
mounted and unmounted. Test the pure parts (`drawerDrag.ts`, `spring.ts`) with
Vitest.

## Done when

Both readers share one drawer gesture; a flick dismisses, a slow pull past a
quarter dismisses, a re-grab mid-animation continues from where the sheet is;
`drawerDrag` and `spring` have passing tests; typecheck passes.
