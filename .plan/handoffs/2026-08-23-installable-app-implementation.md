# Handoff: installable-app, tickets 01 to 05 (implementation)

**Date:** 2026-08-23 · **Previous session:** a `/grilling` session that resolved
[reader-experience/02](../maps/reader-experience/tickets/02-download-course-for-offline.md) and
charted the `installable-app` effort. **Planning only, no code written.**

## What you are building

The app becomes **installable per tenant**, with our own branded install prompt and an offline
course list. Nothing about it exists yet: `public/` holds a favicon, `icon.svg` and two demo HTML
files, and a tree-wide search for `manifest` / `serviceWorker` / `PWA` / `beforeinstallprompt`
returns **zero hits in `src/` or `convex/`**. Start from nothing; do not go looking for partial
groundwork.

**Read these two first, in full, before writing anything:**

1. [ADR 0030](../../docs/adr/0030-installable-per-tenant-app.md) - the decision record, including
   the alternatives that were rejected and why.
2. [The spec](../maps/installable-app/spec.md) - the build contract, scope boundaries and the
   constraints carried out of the codebase.

Nothing in either is open for reopening. If you find a reason one must be, that is a map edit and
an ADR conversation, not a quiet deviation.

## Where the map stands

All five tickets are unstarted. The dependency graph:

```
01 (manifest + App Icon)  ---> 02 (service worker) ---> 03 (Android sheet) ---> 04 (iOS sheet)
                                              \
                                               ---> 05 (Offline Catalogue)
```

- **01 is the only ticket on the frontier.** Start there.
- **02** needs 01 because Chrome will not report the app installable without both.
- **03** needs both (there is nothing to install until they exist).
- **05** needs 02 only, so **05 and 03 can run in parallel** once 02 lands.
- **04** is deliberately last and deliberately its own commit.

Start the next session with:

```
/wayfinder .plan/maps/installable-app/tickets/01-per-tenant-manifest-and-derived-app-icon.md
```

Per CLAUDE.md, build each ticket with `/tdd` (test-first) and `/ponytail` (laziest thing that
works). Write each ticket's `## Answer` as you finish it, since that is what resolves it.

## The five decisions in one breath each

1. **Manifest is a route handler**, never Next's `app/manifest.ts` (that convention is statically
   generated at build time and cannot vary by `Host`, which is the one thing it must do). Reads the
   existing `getTenantView()` rail.
2. **The App Icon is derived, not uploaded** - composited from the tenant Logo onto an opaque
   square of its own palette, by `ImageResponse` from `next/og`. **No new dependency.**
3. **The service worker has exactly three rules**: hashed static assets cache-first forever;
   navigations network-first with a cached `/` fallback; everything else, including `?_rsc=` and
   Convex, network only.
4. **The prompt is ours, on `/` only**, ~3s after load, dismissible for 30 days, and it is a
   different feature on each platform because iOS has no `beforeinstallprompt`.
5. **Offline means lists, never Lesson bodies.**

## Traps that will cost you a day if you miss them

- **Convex is a WebSocket.** Offline it does not error, it never connects, so `useQuery` sits at
  `undefined` **forever**, indistinguishable from loading. Every offline render path keys off that.
  Do not write an error boundary; no error is ever raised.
- **`hindi:install-dismissed` must go in the `KEEP` set** of
  `src/app/_components/accountLocalState.ts`. It is a device preference, like `hindi:theme` and
  `hindi:last-auth`. If the sign-out sweep eats it, every sign-out re-nags the learner to install.
- **The Offline Catalogue keys must NOT be in `KEEP`.** The dashboard list is per-account, so the
  sweep clearing it is exactly right and handles the shared-browser case for free. Opposite of the
  line above; get them the right way round.
- **Network-first for navigations is not a preference, it is the deploy-safety mechanism.** Cache
  documents first and a deploy serves stale HTML pointing at deleted chunks, which is a white
  screen for anyone who had the old page cached.
- **Never cache `?_rsc=`.** App Router client navigation goes stale in ways that are horrible to
  debug.
- **Icons must be opaque.** iOS renders transparency as solid black, so a transparent PNG gives you
  a black square on the home screen.
- **Test the icon on YWAM.** Its logo is roughly 7:1; it is the hard case and the reason the
  padding rule exists. It is *expected* to read as a wide logo in a coloured square. That was
  accepted knowingly, so do not "fix" it by cropping.
- **Tenant logos are raster only** (`assertEmblemImage` refuses SVG as an XSS vector). Convenient,
  because `ImageResponse` handles raster and not SVG.

## The release gate, which is not negotiable

**This work is not done until a Google sign-in has been completed inside the installed app on a
real iPhone**, and the outcome written into
[ticket 04's `## Answer`](../maps/installable-app/tickets/04-the-ios-instruction-sheet.md) either
way.

An installed iOS app has its own cookie jar, separate from Safari, so a learner signs in once
inside it (fine: 365-day cookie, 60-day rolling window). The risk is OAuth. `signIn("google", {
redirectTo: window.location.href })` navigates to `accounts.google.com`, necessarily outside
manifest scope, and on some iOS versions the return completes in Safari, leaving the learner signed
in *there* and still signed out in the app, **with no error shown**. Reading the code cannot settle
this. Walk it.

If it does break, file the follow-up ticket rather than leaving a note: the fix is to reorder the
sign-in buttons when standalone, and `SignIn` already tracks `lastUsed`.

Per CLAUDE.md, say which kind of evidence you had. "Verified by reading the code" and "walked in a
browser" are different claims, and for this gate only the second one counts.

## Two things knowingly accepted, so you do not relitigate them

- **This jumped ui-overhaul's queue.** That effort is at 2 of 13 tickets and its design foundation
  (ticket 03) is unresolved, so the install sheet is a new UI surface built before the system that
  would govern it. Overridden on the user's instruction. Expect to restyle one component later.
- **Nobody can measure whether any of this works.** PostHog is not wired (ui-overhaul 07 to 11), so
  there is no install rate, no funnel, no replay. Any later claim about whether the sheet earns its
  place is opinion until that ships.

## Out of scope, with homes

- Offline Lesson content, the lease, and the offline Response/Progress queue:
  [reader-experience/05](../maps/../maps/technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md).
- The `/content` open-bearer-URL exposure this grilling uncovered:
  [marketplace/12](../maps/../maps/technical-foundation/tickets/04-content-route-is-an-open-bearer-url.md). Worth
  reading even though it is not yours, because it is why offline content was deferred rather than
  encrypted.
