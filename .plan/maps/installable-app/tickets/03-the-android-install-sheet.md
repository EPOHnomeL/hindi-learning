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
