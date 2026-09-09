---
type: task
blocked_by: []
---
# Turn on field measurement, so the rest of this map is verifiable

## Question

Every number in the scan
([assets](../assets/2026-09-09-client-performance-scan.md)) came from a local
`pnpm build` on a developer machine on a developer connection. None of it is observed
against the devices and networks the learners actually use, which for this product means
mid-range Android phones on South African mobile data.

The consequence is not academic. Six build tickets on this map each claim an effect, and
without field data every one of them resolves on "it should be faster" rather than "it
is". That is the difference the repo's own conventions insist on elsewhere: evidence
over inference, and say which you had.

PostHog is already initialised and already captures exceptions
(`src/app/PostHogClient.tsx`), with source maps uploaded at build so client errors
symbolicate. What it does not collect is Core Web Vitals: there is no
`useReportWebVitals`, no `web-vitals` import, and `capture_performance` is not
configured. So the instrumentation rail exists and is trusted; it simply is not carrying
this signal.

**Turn it on, and record a before baseline while the tree is still unoptimised**, because
once ticket 02 lands the comparison is gone.

The privacy commitment in `ConvexClientProvider.tsx` and on `/privacy` is load-bearing
and must not be weakened to do this: the only person property we send is the Convex user
document ID, no email and no name. Web vitals are page-level measurements and should need
nothing more, but confirm rather than assume, and if turning this on would send anything
else, say so in the Answer instead of shipping it.

## Done when

- LCP, INP and CLS arrive in PostHog from real sessions, without adding any person
  property beyond the Convex user document ID that is sent today.
- A **before** baseline is captured and written into the Answer: the reader route and the
  dashboard, at the percentiles that matter (not the mean), from enough real sessions to
  be worth quoting.
- The Answer states plainly whether `/privacy` needs a line changing. If it does, the
  change lands in the same commit, per the standing rule in that file's own comment.
