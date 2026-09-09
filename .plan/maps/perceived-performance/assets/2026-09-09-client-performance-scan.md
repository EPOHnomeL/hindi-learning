# Performance scan, 2026-09-09

Scanned at `fe1ebe7` (main, clean). Numbers come from a real `pnpm build` on this
tree, not estimates; where a claim is inferred rather than measured it says so.

**What this is not.** The repo is already careful about perceived performance:
`ui.tsx` ships four purpose-built skeletons (`ReaderSkeleton`, `CourseSkeleton`,
`DashboardSkeleton`, `SidebarSkeleton`), `CourseSetupPane` narrates a ten-minute
wait with staged progress, `globals.css` carries ~15 hand-tuned keyframes all
gated on `prefers-reduced-motion`, `useMutationRun` gives every control a `busy`
flag and a real refusal message, content blobs are served `immutable` with a
one-year max-age, and the two heavy libraries (`html-to-image`, `canvas-confetti`)
are already behind dynamic `import()`. The easy wins are taken. What follows is
what is left.

---

## Measured baseline

```
Route (app)                                 Size  First Load JS
f /                                      16.1 kB         282 kB
f /courses/[slug]/lessons/[key]           205 B          285 kB
f /share/[token]/lessons/[key]            201 B          280 kB
f /courses/[slug]/manage                 15.7 kB         273 kB
+ First Load JS shared by all             102 kB
f Middleware                             51.1 kB
```

Fonts emitted: 1.3 MB total, **609 KB marked for preload**.
Every route is `f` (dynamic), because the root layout reads `headers()` for the
tenant and the buyer country, so nothing is statically cacheable, including
`/terms`, `/privacy` and `/refunds`.

No `loading.tsx`, `error.tsx` or `not-found.tsx` exists anywhere in `src/app`.
No web-vitals reporting exists, so none of this is currently observed in the field.

---

## 1. About 221 KB of fonts preload on every page for a locale that renders none of them

**Measured.** `src/app/layout.tsx` declares three `next/font/google` families at
module scope and puts all three variables on `<html>`. `next/font` therefore
preloads all three on every route. Mapping the preloaded hashes back to their
`@font-face` rules:

| file | family | size |
|---|---|---|
| `73fd63d6adb7b86c-s.p.woff2` | Noto Serif Devanagari 400 | 127 KB |
| `fb12bdfc6f99d938-s.p.woff2` | Noto Naskh Arabic 400 | 94 KB |
| four small files | Spectral latin 400/600, roman and italic | ~60 KB |

Devanagari and Naskh are documented in that file as *escape hatches*: they render
only when `isDevanagari(locale)` or `isRtl(locale)` puts `font-deva` / `font-naskh`
on `<body>`. An English, Afrikaans, Spanish or French visitor downloads 221 KB of
glyphs at preload priority and paints not one of them. That is the largest single
item in the whole scan and it competes with the JS for bandwidth during LCP.

**Fix.** `preload: false` on `notoDeva` and `notoNaskh`. Two lines. They keep
`font-display: swap`, so a Hindi or Urdu visitor still gets them, one swap later
than today. That is the trade, and it is worth naming explicitly: a small
regression for Hindi/Urdu chrome in exchange for a large win for every other
locale. If the Hindi cost matters, the follow-up is a conditional
`<link rel="preload">` in `<head>` keyed on `isDevanagari(locale)`, which the
layout already computes.

**Estimated effect:** about 221 KB off the critical path for the majority of loads.

## 2. Lesson navigation is three serial round trips, and Next prefetch cannot help

**Measured, then inferred.** Opening a lesson runs, strictly in order:

1. **RSC fetch** for `/courses/[slug]/lessons/[key]`. The page is a server
   component (`await params`), so a client navigation must hit the server even
   though the page body is 205 B and renders one client component.
2. **Convex `getLesson`** (`ArtifactView.tsx:442`), a websocket round trip that
   returns a `contentUrl`, not the body.
3. **`fetch(contentUrl)`** (`useContentHtml`, `ArtifactView.tsx:110`), a second
   HTTP round trip for the actual HTML, then `buildSrcDoc`, then the iframe parses
   it, then it posts its height back.

`ReaderSkeleton` covers steps 2 and 3 (`ArtifactView.tsx:511`), which is why this
feels acceptable rather than broken. But it is a skeleton on *every* lesson click,
including going back to a lesson read thirty seconds ago.

Step 1 is the one that is silently un-optimised. `<Link>` prefetch for a dynamic
route only prefetches down to the nearest `loading.tsx` boundary. There is none in
this repo, so the sidebar's 30 lesson `<Link>` elements (`CourseShell.tsx:326`)
prefetch nothing useful and every click pays the full RSC round trip before Convex
is even asked.

**Fix, in order of ratio:**

- **`loading.tsx` at `courses/[slug]/lessons/[key]`** returning `<ReaderSkeleton />`.
  The component already exists. This does two things at once: it makes Next's
  prefetch actually cache the route segment, and it paints the skeleton the instant
  the link is clicked rather than after the server responds.
- **A module-level `Map<url, html>` in `useContentHtml`.** The blob is immutable
  and already HTTP-cached, but the state is component-local, so revisiting a lesson
  re-enters the `undefined` branch and re-flashes the skeleton for a body the disk
  already holds. A shared cache makes back-navigation paint instantly.
- **Warm the next lesson.** `nextLessonKey` is already threaded into `LessonView`.
  A `useQuery` for the next lesson body (Convex holds the subscription, so the click
  resolves from cache) plus a bare `fetch(contentUrl)` to prime the HTTP cache turns
  the common forward path, which is how the reader is actually used, into no
  network at all.

## 3. Nothing is optimistic: 68 mutation call sites, zero optimistic updates

**Measured.** `grep` finds 68 `useMutation(` call sites and zero uses of
`withOptimisticUpdate`. Every state change in the app waits for a server round trip
before the UI moves.

The one that matters most is completion. `completeLesson` (`ArtifactView.tsx:507`)
fires `setProgress` fire-and-forget and navigates. The learner lands on the next
lesson, and the tick against the lesson they just left, in the sidebar, in the
course progress bar, on the dashboard card, appears a beat later, out of step with
the navigation that caused it. Same for the `opened` write on mount.

**Fix.** Give `setProgress` a `withOptimisticUpdate` that patches the local
`myProgress` result. One mutation, one wrapper, and the tick lands on the same frame
as the click. `recordResponse` (quiz answers) is the second candidate.

This is also where "feels interactive" is actually won, more than by any animation.

## 4. Every page load ships the full message catalogue

**Measured.** `messages/en.json` is 45 KB; `hi.json` is 84 KB; `ur.json` 65 KB.
`layout.tsx` mounts `<NextIntlClientProvider>` with no `messages` prop, so it
inherits and serialises the *entire* catalogue into the RSC payload for every cold
load, regardless of how many strings the page uses.

**Fix.** Pass only the namespaces the client tree needs. next-intl supports
narrowing the provider's `messages`; the namespaces here are already well-separated
(`Reader`, `Common`, `Artifact`, and so on). This is fiddlier than the others
because it needs a per-route decision about which namespaces cross the boundary, so
it is worth doing after 1 to 3.

## 5. The dashboard pops in in four independent pieces

**Measured.** `Dashboard.tsx` holds six top-level `useQuery` subscriptions
(`dashboard`, `myAdminScope`, `amIAllowlisted`, `listSharedTopics`, `myPurchases`,
`myPendingIntents`) but gates on only one (`courses === undefined`,
`Dashboard.tsx:195`). The shared-courses, purchased and pending-EFT sections each
mount when their own query lands, so the page grows underneath the reader in three
or four steps.

The root layout already fights the symptom. There is an inline script forcing
`history.scrollRestoration` to `manual` precisely because "the grid grows underneath
[the skeleton] and the learner is left staring at the footer". That comment is the
bug report for this finding.

**Fix.** Reserve the space: render each section's skeleton while its query is
`undefined` rather than rendering nothing. `DashboardSkeleton` shows the shape to
copy. Cheap, and it removes the layout shift rather than compensating for it.

## 6. Cold start is a four-step serial chain before any content

**Inferred from the architecture, not measured.** Every authed surface is
client-rendered against Convex: HTML, then JS parse, then the Convex websocket
handshake, then the auth token exchange (`AppGate`'s `AuthLoading`), then the first
query, then paint. The skeletons make this civil, but it is still four sequential
waits before a learner sees a word.

`convex/nextjs` exports `preloadQuery`, and the course layout already proves the
pattern works here: it calls `fetchQuery(api.content.reader.topicTenant)`
server-side (`courses/[slug]/layout.tsx`). Preloading `dashboard` and `getLesson` in
their server components would let the first paint carry real content, with the
websocket taking over for reactivity once it connects.

This is the largest structural win and the largest change. It is map-sized on its
own and should not be bundled with the rest.

## 7. There is no measurement

No `useReportWebVitals`, no `web-vitals` import. PostHog is initialised
(`PostHogClient.tsx`) and captures exceptions, but `capture_performance` is not
configured, so LCP/INP/CLS are not collected from the field. Every number above is
from a local build; none of it is observed against real devices on real South
African networks, which is the population that actually matters here.

**Fix.** Turn on PostHog web vitals in `posthog.init`. It is a config key, and it
is what makes items 1 to 6 verifiable rather than plausible.

---

## Suggested order

| # | Item | Effort | Effect |
|---|---|---|---|
| 7 | PostHog web vitals | minutes | none directly; makes the rest measurable |
| 1 | `preload: false` on Deva and Naskh | minutes | about 221 KB off the critical path |
| 2a | `loading.tsx` on the lesson route | small | instant skeleton, working prefetch |
| 3 | Optimistic `setProgress` | small | completion ticks on the click |
| 2b | Shared blob cache, next-lesson warm | small | back/forward and forward-nav feel local |
| 5 | Dashboard section skeletons | small | removes the pop-in |
| 4 | Narrow the message catalogue | medium | smaller RSC payload per cold load |
| 6 | `preloadQuery` for dashboard and lesson | large | removes two waits from cold start |

Items 7, 1, 2a, 3, 2b and 5 are one session's work between them and the route is
clear, so they fit the CLAUDE.md pipeline rather than a map. Items 4 and 6 each
carry open decisions and are map-sized.
