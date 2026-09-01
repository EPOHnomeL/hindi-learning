---
type: task
blocked_by: []
---
# The iOS instruction sheet

## Question

What does an iPhone learner see, given that the one-tap install of ticket 03 is impossible there?

**Apple has never shipped `beforeinstallprompt` and shows no sign of doing so.** There is no API
that adds an iOS app to the home screen; the only route is the user tapping Share -> "Add to Home
Screen" themselves. So an "Install" button on iOS would be a button that cannot do what it says.

The honest version is an **instruction sheet**: the same branded bottom sheet as ticket 03, but its
body shows the Share glyph and two short steps ("Tap Share", "Choose Add to Home Screen") instead
of an Install button. Same trigger, same `/`-only placement, same `hindi:install-dismissed` key and
30-day suppression, so a learner who dismisses on either platform is treated the same way.

**Detection.** iOS Safari, not standalone. Every browser on iOS is Safari underneath, so this is
about the platform rather than the browser brand; do not try to exclude iOS Chrome, which has the
same Add-to-Home-Screen route.

**Deliberately a separate commit from ticket 03.** The iOS half converts far worse - it asks the
reader to perform three steps in a menu many have never opened - and if it proves more annoying
than useful it should be deletable without unpicking the Android path that works.

This ticket also carries the **release gate** for the whole effort, because it is the point at which
iOS is actually exercised:

**A Google sign-in must be completed inside the installed app on a real iPhone.** An installed iOS
app has its own cookie jar, separate from Safari, so the learner signs in once inside the app -
acceptable, given a 365-day cookie and a 60-day rolling window
(`src/lib/sessionLifetime.ts`). The risk is OAuth: `signIn("google", { redirectTo:
window.location.href })` in `SignIn.tsx` navigates to `accounts.google.com`, necessarily outside
manifest scope, and on some iOS versions the return completes in Safari - leaving the learner
signed in *there* and still signed out in the app, **with no error shown**. Behaviour varies by iOS
version and no amount of code reading settles it.

Not pre-emptively worked around: the password path is unaffected either way, and permanently
de-emphasising the sign-in most people prefer, to defend against a bug not yet confirmed on current
iOS, is the worse trade. If it does break, the fallback is to reorder the sign-in buttons when
standalone - and `SignIn` already tracks `lastUsed`, so that machinery exists.

**Progress note (2026-08-24, code built, gate NOT walked).** The sheet itself shipped in
commit `2c3dd01` (its own commit, deletable without touching the Android path, as
specified): `isIosBrowser(userAgent, maxTouchPoints)` in `installPromptDerive.ts`
(unit-tested incl. iOS Chrome and iPadOS-as-Mac), and `InstallSheet` shows the Share
glyph and the two steps when iOS and no `beforeinstallprompt` was captured; same
trigger, same dismissal key. Walked in emulated-iPhone Chromium: instructions after
~3s, no Install button, dismissal persists, nothing when `navigator.standalone`,
nothing on desktop. **This ticket stays open because its release gate needs a real
iPhone**: install via Share -> Add to Home Screen, then a Google sign-in AND a password
sign-in completed inside the installed app, outcome written into the Answer either way.
That walk is a human's.

## Done when

- On a real iPhone in Safari, the sheet appears on `/` with Share-icon instructions and no Install
  button.
- Following the instructions installs the app with the tenant's App Icon and name.
- The sheet does not appear inside the installed app (`navigator.standalone`).
- Dismissal behaves as on Android and survives sign-out.
- **The gate:** a Google sign-in completed *inside* the installed app on a real iPhone, and the
  outcome written into this ticket's Answer either way. If it fails, a follow-up ticket exists for
  the standalone sign-in reordering - do not leave it as a note.
- Password sign-in inside the installed app also confirmed working.

<!-- Moved 2026-09-01 from `installable-app/04` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. `blocked_by: [03]` was dropped, not lost: `installable-app/03` (the Android sheet) is RESOLVED and stayed on that map, so the edge could not be expressed map-locally and no longer gates anything. -->
