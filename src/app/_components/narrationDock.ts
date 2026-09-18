// The docked narration player's arithmetic (course-narration ticket 01, variant
// B, 2026-09-18). Two pure functions, split out here for the same reason
// `drawerDrag.ts` is: the component owns the `<audio>` element and the pixels,
// and the sums it does on the way are worth testing without one.
//
// Both take numbers straight off an `HTMLAudioElement`, which is why they are
// this defensive. `duration` is NaN between `src` landing and `loadedmetadata`,
// and the dock renders in that window; `currentTime` can sit a frame past
// `duration` at the end. Neither may reach the DOM as "NaN:NaN" or "width:101%".

// Is this a real number of seconds, or one of the placeholders an audio element
// reports while it has nothing to say?
function usable(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

// A position as a clock. Minutes and seconds for anything under an hour (every
// lesson in the pilot: the longest measured is around nine minutes), and hours
// above it so a stitched course-wide track never renders "73:04".
export function clock(seconds: number): string {
  const s = usable(seconds) ? Math.floor(seconds) : 0;
  const ss = String(s % 60).padStart(2, "0");
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${ss}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${ss}`;
}

// How much of the track is behind you, 0 to 1, for the hairline along the top of
// the dock. Clamped at both ends, and zero whenever the duration is not yet a
// number, because `width: NaN%` is a declaration the browser drops entirely,
// leaving the previous frame's fill on screen.
export function progress(current: number, duration: number): number {
  if (!usable(duration) || duration === 0 || !usable(current)) return 0;
  return Math.min(1, current / duration);
}
