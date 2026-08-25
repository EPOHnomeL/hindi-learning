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

// Is this Samsung Internet? Samsung mints its OWN WebAPK rather than using
// Chrome's minting service, and that APK is built against an old targetSdk, so
// Android 13+ refuses it: "Unsafe app blocked. This app was built for an older
// version of Android and doesn't include the latest privacy protections."
// Reported on ywampotch.my-course.app 2026-08-25 and reproducible for every
// tenant; nothing in our manifest can change it, because targetSdk belongs to
// whoever mints the APK. So Samsung Internet does NOT get the Install button:
// it gets sent to Chrome, whose WebAPK Play Protect trusts. Same call
// Progressier made in March 2026.
//
// Deliberately narrow: SamsungBrowser only. Samsung's UA also says Chrome/<v>
// (it is Chromium), so a bare /Chrome/ test would sweep in the browser that
// works fine.
export function isSamsungInternet(userAgent: string): boolean {
  return /SamsungBrowser\//.test(userAgent);
}

// The Android intent URL that reopens this page in Chrome. `href` is the full
// current URL; the scheme is stripped from the intent body and restated in the
// scheme= field, which is what the intent syntax requires. S.browser_fallback_url
// sends a phone with no Chrome installed to the plain page instead of a dead tap.
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  const scheme = url.protocol.replace(":", "");
  const body = href.slice(url.protocol.length + 2);
  return `intent://${body}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
