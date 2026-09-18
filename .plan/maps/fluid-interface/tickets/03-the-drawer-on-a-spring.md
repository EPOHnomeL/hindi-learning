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

## Answer

Built 2026-09-18, commit `15f454b`. Verified by 20 unit tests on the pure
parts and typecheck; **not walked in a browser**, and this is the ticket where
that matters most. The owner should open a course on a phone and pull the
drawer before trusting the constants.

- `spring.ts`: a pure `step` integrator (semi-implicit Euler in 1/240s
  sub-steps) and a `createSpring` driver on `requestAnimationFrame` with
  injectable clock and rAF for tests. `animateTo` retargets from the live value
  and velocity, so a re-grab or a reversed intent never jumps. Response 0.3s,
  damping 1.0; when a release exceeds 600 px/s the flight uses damping 0.8.
  Under reduced motion it paints the target once.
- `useSheetDrag(open, setOpen)` is the one gesture for both readers. The finger
  writes the transform directly, no React state per frame. Release velocity is
  measured over the last 100ms of samples. Above 300 px/s the sign decides
  (down dismisses, up snaps open); below it the existing quarter-height rule
  with an 80px floor decides. Above rest the sheet rubber-bands with Apple's
  constant 0.55. The `open` prop and the release both fly through the same
  spring, so enter and exit share a path.
- The scrim stays mounted while the sheet is open or in flight and its opacity
  is painted each frame as 0.4 times the sheet's progress.
- Shut and desktop states stay class-driven (`translate-y-full md:translate-y-0`),
  so a taller lesson list never leaves a stale parked position and the desktop
  sidebar carries no transform.

Known edge to watch on the walk: an upward flick above 600 px/s overshoots
rest by a beat. The authed reader's tab bar hides it; the Guest reader has no
tab bar and may show a hairline gap. Setting `BOUNCY_DAMPING` to 1 in
`useSheetDrag.ts` removes it.
