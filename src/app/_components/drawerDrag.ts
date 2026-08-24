// Swipe-to-dismiss arithmetic for the reader's mobile lesson drawer
// (2026-08-24). The drawer had a grab handle that looked draggable and wasn't:
// the only way to shut it was the scrim or the hamburger, so pulling the handle
// down did nothing and read as a dead sheet. These two pure functions are that
// gesture; the component owns the pointer events and the transform.

// How far the sheet has been pulled from where the finger went down. Clamped at
// zero on purpose: upward drag must not lift the sheet past its rest position,
// which would open a gap between it and the bottom of the screen.
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
