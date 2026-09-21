---
type: task
blocked_by: [01]
---
# Best Practices to 100 on the four public routes

## Question

The Best Practices category is the one whose failures are usually symptoms of something
real: a console error on a cold load is a bug a stranger is hitting, and a failed request
is a wasted round trip on the critical path.

Nothing is measured yet, so **01's failed-audit list is the scope.** What the tree
suggests will show up, read on 2026-09-21:

- **Console errors and failed requests on a signed-out cold load.** The landing page
  mounts PostHog (`PostHogClient`), registers the service worker
  (`RegisterServiceWorker`), and `Landing.tsx` renders an `Image onError` fallback for
  the founder portrait. `dropFramelessNetworkRejection` exists in
  `src/lib/posthogBeforeSend.ts` specifically because frameless unhandled network
  rejections "recur on every flaky connection", which says such rejections are real and
  routine. Suppressing them in error tracking does not stop Lighthouse seeing them in
  the console.
- **The CSP audit.** `src/app/layout.tsx` emits two inline `script
  dangerouslySetInnerHTML` blocks and one inline `style id="tenant-theme"`. The inline
  style is load-bearing: the tenant palette is baked in pre-paint so a tenant host never
  flashes the default skin. So this is not "remove the inline code", it is "make a CSP
  that permits exactly these", which means nonces, which means deciding whether that is
  worth a point. **It may not be.** Ruling it out with a reason written down is a valid
  outcome for this bullet, and better than a nonce pipeline nobody maintains.
- **Source maps.** `withPostHogConfig` uploads browser source maps at build, gated on
  `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` being present. Lighthouse has a "Missing
  source maps for large first-party JavaScript" audit. Whether the preview deploy has
  those secrets set decides whether this passes, and that is worth knowing either way.
- **Third-party cookies and deprecated APIs.** PostHog is the only third party on the
  public path. Check what it sets and what it calls.
- **Image aspect ratio.** The founder portrait is `fill` inside an `aspect-square` box
  with `object-cover`, which should pass; 01 will say.

The service worker deserves its own caution. `public/sw.js` is hand-rolled, three rules,
and the comment block is explicit that rule 2 (network-first navigations, falling back to
a cached `/`) is "the deploy-safety mechanism, not a preference", and that `VERSION` must
be bumped on any change to the file. **A Best Practices fix is not a reason to touch that
file.** If one appears to be, it is a different ticket on `installable-app`.

## Done when

- The Best Practices category scores 100 on all four public URLs with the 01 harness, or
  the Answer names each remaining point and why it was deliberately not bought. The CSP
  audit is the expected candidate for the latter.
- A signed-out cold load of each of the four URLs produces no console error and no failed
  request, walked with the console open. Any error found is fixed at its cause, not
  silenced.
- The Answer states whether the preview deploy uploads source maps, and therefore whether
  that audit passes in the environment being scored.
- `public/sw.js` is unchanged, or the Answer explains why it had to change and confirms
  `VERSION` was bumped.
