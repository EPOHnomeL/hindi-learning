# Spec: the installable per-tenant app

<!-- Written 2026-08-23 from a /grilling session. The design decisions are recorded in
     ADR 0030 (docs/adr/0030-installable-per-tenant-app.md) and the App Icon / Offline
     Catalogue glossary terms in CONTEXT.md; this spec is the build contract, not the
     decision record. Where the two disagree, the ADR wins and this file is stale. -->

## Problem Statement

The app cannot be installed. On a phone it is a browser tab, and a learner who wants to come back
has to remember a URL or find it in their history. There is no icon on their home screen, no
splash, no chrome-less window - and nothing at all happens on a bad connection except a browser
error page.

The groundwork was believed to exist and does not. `public/` holds `favicon.ico`, `icon.svg` and
two demo HTML files: no manifest, no service worker, no `next-pwa`, no `viewport`/`themeColor`
export, no `apple-touch-icon`. The retired `pwa` map recorded its ticket 01 as closed; the
[surface inventory](../ui-overhaul/tickets/04-surface-inventory.md) checked and **nothing had
shipped**. This spec therefore starts from zero, not from a partial PWA.

Two constraints make it more than a manifest drop-in.

**The product is whitelabeled per host.** A learner does not install "My Course" - they install
UPF, or YWAM Potchefstroom, or Almighty Warriors. The installed name, icon, splash colour and
theme colour all have to be the tenant's, resolved from the `Host` header like everything else
([ADR 0022](../../../docs/adr/0022-tenant-subdomain-model.md)).

**No tenant has a square app icon and none is coming.** Logos are raster, size-capped, and per the
`Brand.tsx` comments *"vary wildly in aspect (yknot ~2.6:1 horizontal, YWAM ~7:1 banner, Almighty
Warriors ~1:1 stacked)"*. Platforms will not take that: they want an opaque square, and Android
crops a maskable icon to a circle while iOS renders transparency as solid black.

## Solution

Every tenant subdomain becomes its own installable app - which costs nothing structurally, because
host-based tenancy plus a host-only session cookie
([ADR 0025](../../../docs/adr/0025-per-tenant-session-isolation.md)) already make each subdomain a
separate origin with separate storage.

Three parts:

1. **A per-tenant manifest and a derived App Icon.** `/manifest.webmanifest` is a route handler
   reading the existing `getTenantView()` rail. The icon is composited at request time from the
   tenant's Logo onto an opaque square of its own palette, via `ImageResponse` from `next/og` -
   **no new dependency**, and no per-tenant design chore.
2. **Our own install prompt.** A tenant-branded bottom sheet on `/`, ~3s after load, both auth
   states, dismissible for 30 days. On Android it replays the captured `beforeinstallprompt` and
   opens the real OS dialog. On iOS - which has no such event and never will - it shows Share ->
   Add to Home Screen instructions instead.
3. **A shell-caching service worker and an Offline Catalogue.** The worker makes the app launch
   offline at all; the Offline Catalogue is the last course list the reader saw, rendered whenever
   the live Convex query has not resolved. **Lists only - never Lesson bodies**
   ([ADR 0030](../../../docs/adr/0030-installable-per-tenant-app.md) §3).

## User Stories

**The learner installing**

1. As a learner on Android, I want one tap on "Install" to actually install the app, so that the
   prompt is not a set of instructions I have to follow by hand.
2. As a learner on iPhone, I want to be told *how* to add the app to my home screen, so that the
   feature is not silently missing on my device.
3. As a learner, I want the installed app to carry the name and mark of the organisation whose
   course I am taking, not the platform's, so that what is on my home screen is the thing I signed
   up for.
4. As a learner who does not want the app, I want "Not now" to be respected for a good while, so
   that I am not asked again every time I open the site.

**The learner offline**

5. As a learner with no signal, I want the app to open rather than show a browser error, so that
   tapping the icon is never a dead end.
6. As a learner with no signal, I want to see the courses I had, so that the app is recognisably
   mine rather than empty.
7. As a learner with no signal, I want to be told plainly that a lesson needs a connection, so
   that I am not left guessing whether it is broken.

**The operator**

8. As an operator, I want a new tenant to be installable the moment its row exists, so that adding
   a tenant does not also mean commissioning an app icon.

## Scope

**In:**

- Per-tenant `/manifest.webmanifest`, including one for the default site.
- Derived App Icon at 192, 512, maskable, and 180 (`apple-touch-icon`).
- `viewport` / `themeColor` metadata.
- A service worker with the three caching rules, registered client-side.
- The install sheet: Android (`beforeinstallprompt`) and iOS (instructions), separate commits.
- 30-day dismissal under `hindi:install-dismissed`, added to the `KEEP` set.
- Offline Catalogue: last-known-good caching of `api.catalogue.list` and
  `api.content.reader.dashboard`, plus an honest offline state on a course a reader taps.

**Out:**

- **Offline Lesson bodies.** Needs a lease and an offline Response/Progress queue -
  [reader-experience/05](../technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md).
- **The `/content` bearer-URL exposure** -
  [marketplace/12](../technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md).
- **Any uploaded `appIcon` brand asset.** Derived is the decision; an upload is a later additive
  change if a tenant asks.
- **Push notifications, background sync, share targets, app shortcuts.** None asked for.
- **Install prompts anywhere but `/`.** The reader is where the most engaged learner is, and it is
  deliberately left alone for now.
- **Measuring install rate.** Impossible until PostHog lands (ui-overhaul 07-11).

## Constraints carried from the codebase

- The manifest **must** be a route handler. Next's `app/manifest.ts` is statically generated and
  cannot vary by `Host`.
- Convex is a **WebSocket**: offline, `useQuery` stays `undefined` forever rather than erroring.
  Every offline render path keys off that, never off a caught error.
- `hindi:install-dismissed` is a **device** preference, not account state, so it joins `hindi:theme`
  and `hindi:last-auth` in the `KEEP` set of `accountLocalState.ts` - otherwise signing out asks
  the learner to install all over again.
- Tenant Logos are **raster only** - `assertEmblemImage` refuses SVG as an XSS vector. Convenient
  here: `ImageResponse` handles raster and not SVG.
- The lesson iframe is **self-contained** (`lessonSrcDoc.ts`: lessons *"stay self-contained with no
  API calls of their own"*). Rendering a lesson offline would be easy; it is the answer *writes*
  that make offline content hard.

## Release gate

**Not done until a Google sign-in has been completed inside the installed app on a real iPhone.**
An installed iOS app has its own cookie jar, and OAuth necessarily leaves the manifest scope for
`accounts.google.com`; on some iOS versions the return completes in Safari and leaves the learner
signed in *there*, still signed out in the app, with no error shown. Reading the code cannot
answer this. If it does break, de-emphasising Google when standalone is the fallback, and `SignIn`
already tracks `lastUsed`, so the machinery exists.
