# Installable app (per tenant)

<!-- Written 2026-09-01, at the .plan consolidation, for a map directory that never had
     one. See Notes: the absence had a real cost. -->

## Destination

The app is **installable per tenant**, with our own branded install prompt and an
offline course list, so a learner on a tenant subdomain gets that tenant's icon and name
on their home screen. Decided in
[ADR 0030](../../../docs/adr/0030-installable-per-tenant-app.md); the build contract is
[spec.md](spec.md).

Reached, except for one thing a human has to do on a real iPhone. See Notes.

## Notes

- **This map had no `map.md` for its entire life**, only a `spec.md` and its tickets.
  Written on 2026-09-01 during the consolidation that took `.plan` from 33 map
  directories to 7 active maps, when the gap was found. That absence was not cosmetic:
  chartr derives the frontier from maps, so **ticket 04, which carried the release gate
  for the whole effort, was invisible to every frontier from the day it was cut**. It
  never appeared on any board. The lesson generalises past this map: a ticket without a
  map above it is not tracked work.
- **This map carried build tickets throughout**, which is the wayfinder override the
  convention requires in Notes and which this map was never in a position to state. All
  five were execution; every decision was made in ADR 0030 and the spec before any of
  them was cut.
- **Moved out 2026-09-01:** ticket 04 (the iOS instruction sheet) is now
  [learning-experience/08](../learning-experience/tickets/08-the-ios-instruction-sheet.md).
  Its `blocked_by: [03]` was dropped rather than lost, since 03 is resolved and stayed
  here, so the edge could not be expressed map-locally and no longer gates anything.
  **Do not mint a replacement 04 here.**
- **The effort's release gate is still open, and it is a human's.** The iOS sheet's code
  shipped in commit `2c3dd01` and was walked in emulated-iPhone Chromium, but the gate
  needs a real iPhone: install via Share then Add to Home Screen, then a Google sign-in
  **and** a password sign-in completed inside the installed app. An installed iOS app has
  its own cookie jar, and `signIn("google", ...)` necessarily leaves manifest scope, so on
  some iOS versions the return completes in Safari, leaving the learner signed in there
  and still signed out in the app with no error shown. No amount of code reading settles
  it. Until that walk happens, "the app works on iPhone" is an untested claim.
- The four tickets that stay here are resolved, so this map is closed as a planning
  effort. Its record is the tickets, the spec and ADR 0030.

## Decisions so far

<!-- one line per resolved ticket -->

- **01** the per-tenant manifest is a route handler, never Next's `app/manifest.ts`
  (that convention is statically generated and cannot vary by `Host`), and the App Icon
  is **derived** from the tenant Logo by `ImageResponse`, not uploaded, with no new
  dependency.
- **02** the service worker has exactly three rules: hashed static assets cache-first
  forever, navigations network-first with a cached `/` fallback, everything else
  (including `?_rsc=` and Convex) network only.
- **03** the Android install sheet is ours, on `/` only, roughly 3s after load,
  dismissible for 30 days.
- **05** the Offline Catalogue lists what a learner can still open with no network.

## Not yet specified

- Nothing. Every decision was settled in ADR 0030 and the spec before the tickets were
  cut, and the only open work is the real-iPhone walk that
  [learning-experience/08](../learning-experience/tickets/08-the-ios-instruction-sheet.md)
  now owns.

## Out of scope

- **Offline lesson *content***, as opposed to the offline course list. That is a bearer
  URL and lease question:
  [technical-foundation/05](../technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md),
  which is `blocked_by` the `/content` route decision in
  [04](../technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md) there.
- App-store distribution of any kind. This is a web app added to a home screen.
