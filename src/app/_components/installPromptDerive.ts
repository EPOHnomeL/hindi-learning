// The pure decision behind the install sheet's 30-day dismissal (installable-app
// ticket 03): one key, one number. Raw is what localStorage holds under
// INSTALL_DISMISSED_KEY (a Date.now() string written by "Not now"); corrupt or
// missing reads as never dismissed, so the worst failure mode is one extra ask.
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function installDismissed(raw: string | null, now: number): boolean {
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_WINDOW_MS;
}
