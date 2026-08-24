// The reader keeps a little state per person in localStorage — the last-used
// Edition ("hindi:lang"), which answered questions they've already seen
// ("hindi:answers-seen"), guest progress — but the store is per *browser*, not
// per account. On the same
// browser, one account signing out and another signing in would otherwise
// inherit the first person's state (most visibly: a course reopening in the
// previous user's Edition language). So on sign-out we drop every "hindi:*" key.
//
// Light/dark now lives in the host-only `hindi_mode` cookie (a per-tenant device
// preference — see ThemeContext), not in localStorage, so it's untouched by this
// sweep. The legacy "hindi:theme" key is
// kept so a not-yet-migrated user's dark mode survives sign-out until ThemeContext
// migrates it to the cookie.
// Which method signed in on this browser last ("google" | "password"), powering
// the sign-in screen's "Last used" hint (SignIn.tsx) so a returning reader is
// nudged to the right button instead of guessing — and, after #111's email
// linking, so someone with BOTH credentials on one account picks the one they
// actually use.
export const LAST_AUTH_KEY = "hindi:last-auth";

// When the learner tapped "Not now" on the install sheet (installable-app
// ticket 03) as a Date.now() string; the sheet stays away for 30 days from it.
// A device preference like the theme, so it survives the sign-out sweep. The
// Offline Catalogue keys are deliberately NOT kept: the dashboard list is
// per-account, so the sweep clearing those is what handles a shared browser.
export const INSTALL_DISMISSED_KEY = "hindi:install-dismissed";

// Survives the sign-out sweep below, deliberately. The hint is worthless if it is
// wiped by the very act it describes — and unlike an Edition language or guest
// progress it names a *method*, not an identity: it reveals nothing about the
// account that just left, so the shared-browser leak the sweep exists to prevent
// doesn't apply.
const KEEP = new Set(["hindi:theme", LAST_AUTH_KEY, INSTALL_DISMISSED_KEY]);
const PREFIX = "hindi:";

export type AuthMethod = "google" | "password";

// Best-effort both ways — storage can be disabled, and the hint is pure polish, so
// a failure degrades to "no badge" rather than breaking sign-in. Unknown/corrupt
// values read as null rather than being trusted into the UI.
export function readLastAuthMethod(): AuthMethod | null {
  try {
    const value = window.localStorage.getItem(LAST_AUTH_KEY);
    return value === "google" || value === "password" ? value : null;
  } catch {
    return null;
  }
}

export function rememberAuthMethod(method: AuthMethod): void {
  try {
    window.localStorage.setItem(LAST_AUTH_KEY, method);
  } catch {
    /* storage unavailable — the hint is optional */
  }
}

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
