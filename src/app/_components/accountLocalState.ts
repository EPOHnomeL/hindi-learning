// The reader keeps a little state per person in localStorage — the last-used
// Edition ("hindi:lang"), which answered questions they've already seen
// ("hindi:answers-seen"), per-course certificate celebration flags, guest
// progress — but the store is per *browser*, not per account. On the same
// browser, one account signing out and another signing in would otherwise
// inherit the first person's state (most visibly: a course reopening in the
// previous user's Edition language). So on sign-out we drop every "hindi:*" key.
//
// The one exception is "hindi:theme": light/dark is a deliberate device
// preference (chosen even while signed out, on the landing page), so it stays.
const KEEP = new Set(["hindi:theme"]);
const PREFIX = "hindi:";

// Pure over the passed Storage so it's testable without a DOM. Collect the
// doomed keys first, then remove — mutating while iterating by index skips keys.
export function clearAccountLocalState(storage: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(PREFIX) && !KEEP.has(key)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
}

// Browser entry point for sign-out handlers — best-effort (storage can be
// disabled/unavailable), so failures are swallowed.
export function clearAccountLocalStateOnSignOut(): void {
  try {
    clearAccountLocalState(window.localStorage);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
