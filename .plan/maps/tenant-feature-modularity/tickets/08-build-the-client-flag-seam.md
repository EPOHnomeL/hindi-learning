---
type: task
blocked_by: [06, 07]
---
# Build: the client flag seam

## Question

Build the seam [06](06-the-client-hide-seam.md) picked, and nothing else. No feature is hidden by
this ticket. It exists so that [09](09-build-hide-the-existing-five.md) onward are each a handful of
call sites rather than a re-litigation of the loading state.

The seam has to serve five consumer kinds, and a server component cannot use a hook, so at least
two entry points are likely. Keep it thin: this is a boolean lookup with a loading state, not a
framework.

If 06 chose SSR flags, the layout already fetches `getTheme` server-side for the palette. Reuse that
fetch. A second round trip on the hot path for a boolean would be a poor trade.

## Done when

- [ ] The seam exists with the API 06 named, exported from one module with a comment stating it is
      **cosmetic** and that `assertTenantFlag` is the enforcement.
- [ ] A client-component consumer, a server-component consumer, and a route guard each have a
      documented usage, exercised by a test.
- [ ] The loading behaviour 06 picked is implemented, and there is a test that pins it, so the next
      session cannot silently switch it back.
- [ ] `donations` is migrated onto the seam, replacing both hand-rolled checks in
      `src/app/donate/page.tsx` and `DonateSection.tsx`, with no change to what a visitor sees.
- [ ] If SSR flags won: flags reach the layout off the existing `getTheme` fetch, with no second
      Convex round trip, and the Answer says how.
- [ ] `pnpm typecheck` and the unit suite are green.
