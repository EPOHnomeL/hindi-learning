// The pure decision behind the install sheet's 30-day dismissal (installable-app
// ticket 03): one key, one number. Raw is what localStorage holds under
// INSTALL_DISMISSED_KEY (a Date.now() string written by "Not now"); corrupt or
// missing reads as never dismissed, so the worst failure mode is one extra ask.
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function installDismissed(raw: string | null, now: number): boolean {
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_WINDOW_MS;
}

// Is this an iOS browser (installable-app ticket 04)? Platform, not brand:
// every browser on iOS is Safari underneath and shares the Share -> Add to Home
// Screen route, so iOS Chrome (CriOS) is deliberately included. The touch-point
// check catches iPadOS 13+, whose Safari masquerades as a Mac in its UA; real
// Macs report 0 touch points.
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
