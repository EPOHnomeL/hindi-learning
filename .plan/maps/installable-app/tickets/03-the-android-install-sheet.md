---
type: task
blocked_by: [01, 02]
---
# The Android install sheet

## Question

What does the branded install prompt look like, and when is it allowed to appear?

A tenant-branded **bottom sheet** on `/` - dismissible, not a blocking interstitial. The gate was
considered and rejected: `/` is also the public marketing page, a bespoke one per tenant via
`landingFor(slug)`, and it sits one click from checkout. Blocking it taxes acquisition to buy
installs from people who have not yet decided to trust the brand
([ADR 0030](../../../../docs/adr/0030-installable-per-tenant-app.md) §1).

**The Android mechanism.** Listen for `beforeinstallprompt`, `preventDefault()` it, and keep the
event. The sheet's button calls `prompt()` on the stored event, which opens the **real OS install
dialog** - so this is a genuine one-tap install, not instructions. The event firing at all is the
browser confirming the app is installable and not already installed, which is most of the
show/hide logic for free.

**Content.** The tenant's Logo (via the existing `Brand` component, which already handles the
logo-or-fallback case), the `displayName`, one line of copy, an Install button and a "Not now".
Strings go through `next-intl` like the rest of the chrome.

**When it may appear:**

- On `/` only. Not the reader, not checkout - the ask was the home page, and extra surfaces
  multiply "where did this come from" confusion.
- **~3s after load**, so first paint is the tenant's landing content and not a sheet over copy the
  visitor has not read yet.
- In **both** auth states.
- **Never** when already running standalone - `matchMedia('(display-mode: standalone)')`, plus
  `navigator.standalone` for iOS.
- Never unless `beforeinstallprompt` actually fired.

**Dismissal.** "Not now" writes `hindi:install-dismissed` and the sheet stays away for **30 days**.
One key, one number - a two-strikes-then-never rule is a state machine, a second key and a branch
to test for a complaint nobody has made.

That key **must be added to the `KEEP` set** in `src/app/_components/accountLocalState.ts`. It is a
device preference, not account state - the same genus as `hindi:theme` and `hindi:last-auth`, which
are already kept - and if the sign-out sweep eats it, every sign-out asks the learner to install
again. Because tenants are separate origins, dismissing on one tenant leaves the others untouched
with no work.

## Done when

- On Android Chrome, the sheet appears ~3s after loading `/`, branded with the tenant's logo and
  name.
- Tapping Install opens the **OS install dialog**, and completing it installs the app with the
  tenant's App Icon and name.
- The installed app launches chrome-less into `/`.
- The sheet does **not** appear inside the installed app.
- "Not now" hides it, and it stays hidden across reloads; clearing the key brings it back.
- Dismissing on one tenant host leaves another tenant host still prompting.
- Signing out does **not** clear the dismissal (the `KEEP` addition is covered by a test alongside
  the existing `accountLocalState` tests).
- Nothing appears on a desktop browser that never fires the event.

## Answer

Built 2026-08-24. `src/app/_components/InstallSheet.tsx`, mounted in `src/app/page.tsx`
outside the auth gates so it lives on `/` in both auth states and nowhere else. Exactly
the specified mechanism: `beforeinstallprompt` is `preventDefault()`ed and kept; the
sheet renders only when the event has fired AND ~3s have passed AND not standalone
(`display-mode: standalone` media query plus `navigator.standalone`) AND not dismissed;
Install replays the kept event; "Not now" writes `hindi:install-dismissed` as a
`Date.now()` string. The 30-day window is a pure function
(`installPromptDerive.ts`, 4 tests: fresh, within, expired, corrupt), and the key is in
the `KEEP` set with a sweep-survival test beside the existing `accountLocalState`
tests. Content is the existing `Brand` lockup, the `displayName` in one line of copy,
and the two buttons; strings are a `next-intl` `Install` namespace in all five locale
files. Styling is the token palette (`bg-card`/`border-line`/`bg-accent`); per ADR 0030
this surface may be restyled once ui-overhaul 03 lands.

**Evidence, and which kind.** The sheet's behaviour was **walked in a browser**
(headless Chromium, production build, synthetic `beforeinstallprompt` since the real
one requires Android Chrome's install pipeline): hidden before the 3s delay, visible
and branded after; Install calls `prompt()` on the kept event and closes the sheet;
"Not now" writes the key and the sheet stays hidden across reloads; clearing the key
brings it back; with no event fired, nothing ever appears (the desktop case). Sign-out
survival is pinned by the unit test.

**Verified by reading the code only**, because they need a physical Android device or
real tenant hosts: the OS dialog actually installing with the tenant icon and name, the
chrome-less launch into `/`, the sheet's absence inside the installed app (the
standalone guard is code-read, its media query untestable headless), and per-tenant
dismissal isolation (structural: tenant subdomains are separate origins, so separate
localStorage; there is nothing to get wrong in code). These fall out of the release
gate walk on a real device (ticket 04's gate covers the install-and-sign-in pass).
