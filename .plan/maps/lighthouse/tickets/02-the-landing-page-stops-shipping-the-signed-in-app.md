---
type: task
blocked_by: [01]
---
# The landing page stops shipping the signed-in app to strangers

## Question

`src/app/page.tsx` is a `"use client"` module, and it **statically imports the entire
signed-in application** (read 2026-09-21):

```
import { Dashboard }            from "~/app/_components/Dashboard";       // 1016 lines
import { DonationHashRedirect } from "~/app/_components/DonationHashRedirect";
import { InstallSheet }         from "~/app/_components/InstallSheet";
import { OfflineHome, useOffline } from "~/app/_components/OfflineHome";
import { Landing }             from "~/app/_components/Landing";
```

`<Unauthenticated>`, `<Authenticated>` and `<AuthLoading>` are runtime gates, not build
boundaries. A logged-out stranger who opens `/` therefore downloads, parses and
evaluates the Dashboard tree, the Offline Catalogue and the install sheet, and renders
none of them. The 2026-09-09 build scan measured `/` at 16.1 kB route size and **282 kB
First Load JS**, against 102 kB shared by all routes, which is a large number for a
marketing page whose job is to convert a stranger on mobile data.

Lighthouse charges for this twice: as "Reduce unused JavaScript" and, more expensively,
as Total Blocking Time, because parse and evaluate happen on the main thread before the
page is interactive. Both are Performance-category line items on the one URL that
matters most commercially.

The shape of the fix is a dynamic boundary around the authed tree, so the Landing is
what a stranger downloads and the Dashboard arrives only once auth has resolved. What to
get right rather than guess:

- **The tenant landing registry.** `landingFor(slug)` (`src/app/_landing/registry.ts`)
  already swaps in a bespoke per-tenant landing. Whatever boundary is drawn has to keep
  that working, and a tenant landing is the *more* important one to keep cheap.
- **The offline swap must not regress.** `useOffline()` swaps the whole gated tree for
  the Offline Catalogue, and the comment in `page.tsx` records why (walked 2026-08-24:
  an offline boot makes Convex Auth resolve UNAUTHENTICATED and would otherwise hand a
  signed-in learner the marketing page with a dead sign-in form). A lazily-loaded
  `OfflineHome` that needs the network to load is a contradiction. Decide deliberately
  whether it stays eager and say why.
- **No skeleton flash for a signed-in learner.** `<AuthLoading>` already draws
  `DashboardSkeleton` sized by `useCourseGridCount`. A chunk fetch inserted after auth
  resolves must land under that skeleton, not after it, or this trades a stranger's TBT
  for a returning learner's extra wait. That is a bad trade and the ticket does not
  want it.
- **Do not touch what `perceived-performance` owns.** Its ticket 06 is the dashboard's
  section-by-section pop-in and its 08 grills server-side first paint. This ticket is
  only about what crosses the wire to a visitor who never authenticates.

## Done when

- First Load JS for `/` is materially lower than the 282 kB baseline, with the before
  and after numbers from `pnpm build` quoted in the Answer.
- Lighthouse's "Reduce unused JavaScript" finding on `/` is gone or materially smaller,
  and TBT has improved, measured with the 01 harness against a preview URL.
- A signed-out load of `/` requests no Dashboard chunk. Verified in the network panel,
  not inferred from the import graph.
- A signed-in load still lands on the Dashboard with no new visible wait after the
  skeleton, and a bespoke tenant landing still renders. Both walked in a browser, and
  the Answer says which hosts were walked.
- Going offline still swaps to the Offline Catalogue, and the Answer states what was
  decided about loading it eagerly and why.
