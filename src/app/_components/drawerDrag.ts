// Swipe-to-dismiss arithmetic for the reader's mobile lesson drawer
// (2026-08-24). The drawer had a grab handle that looked draggable and wasn't:
// the only way to shut it was the scrim or the hamburger, so pulling the handle
// down did nothing and read as a dead sheet. These pure functions are that
// gesture; `useSheetDrag` owns the pointer events and the spring (fluid-interface
// 03, 2026-09-18), and the readers own the markup.

// How far the sheet has been pulled from where the finger went down. Clamped at
// zero on purpose: upward drag must not lift the sheet past its rest position,
// which would open a gap between it and the bottom of the screen. Kept for the
// clamped case; the live drawer uses `sheetOffset`, which rubber-bands instead.
export function dragOffset(startY: number, currentY: number): number {
  return Math.max(0, currentY - startY);
}

// On release: far enough to mean it, or snap back. A quarter of the sheet's own
// height scales the gesture to the sheet (a tall lesson list needs a longer
// pull), with an 80px floor so a short sheet can't be dismissed by the wobble
// of a thumb that meant to tap.
export function shouldDismiss(offset: number, height: number): boolean {
  return offset > Math.max(80, height * 0.25);
}

// Release speed, in px/s, past which the flick decides on its own: down closes,
// up snaps open, whatever the position. Below it, position decides.
export const FLICK = 300;
// Past this the release carried real momentum and the spring may bounce
// (damping 0.8) instead of stopping dead (map Notes, standing choices).
export const BOUNCY_FLICK = 600;

// Apple's rubber-band: pulling `overshoot` past the edge of a `dim`-sized thing
// moves it a diminishing amount that approaches `dim` and never reaches it. The
// constant 0.55 is the iOS scroll-view feel.
export function rubberband(overshoot: number, dim: number, c = 0.55): number {
  return (overshoot * dim * c) / (dim + c * Math.abs(overshoot));
}

// The sheet's offset from rest for a finger that went down at `startY` and is at
// `currentY`: 1:1 downward (positive), rubber-banded above rest (negative), so
// the sheet resists rather than either clamping dead or tearing a gap. `from` is
// where the sheet was when the finger landed (non-zero for a grab mid-flight).
export function sheetOffset(startY: number, currentY: number, height: number, from = 0): number {
  const raw = from + currentY - startY;
  return raw >= 0 ? raw : -rubberband(-raw, height);
}

// Velocity first, then position: a flick down dismisses however little it
// travelled, a flick up keeps the sheet however far it was pulled, and a slow
// release falls back to the quarter-height rule.
export function decideDismiss(offset: number, height: number, velocity: number): boolean {
  if (velocity > FLICK) return true;
  if (velocity < -FLICK) return false;
  return shouldDismiss(offset, height);
}

export type DragSample = { y: number; t: number };

// How long a stretch of the gesture counts toward its release velocity. A
// finger that stopped and rested before letting go has, correctly, none.
export const VELOCITY_WINDOW_MS = 100;

// Release velocity in px/s (positive is downward) from the pointer samples,
// using only the last `VELOCITY_WINDOW_MS`. Zero when there is nothing to
// measure rather than NaN or Infinity.
export function releaseVelocity(samples: readonly DragSample[]): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const recent = samples.filter((s) => last.t - s.t <= VELOCITY_WINDOW_MS);
  const first = recent[0];
  if (!first || recent.length < 2) return 0;
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return ((last.y - first.y) / dt) * 1000;
}
