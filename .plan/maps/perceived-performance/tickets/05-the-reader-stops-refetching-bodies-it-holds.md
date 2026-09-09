---
type: task
blocked_by: [03]
---
# The reader stops refetching bodies it already has

## Question

Opening a lesson costs three serial round trips. Ticket [03](03-a-loading-boundary-on-the-reader-routes.md)
removes the first. This ticket is the other two.

**Going back re-flashes a skeleton for a body the disk already holds.** `useContentHtml`
(`ArtifactView.tsx:110`) fetches the body blob and keys it to its URL in **component
local** `useState`. The blob is served `immutable` with a one-year max-age
(`convex/http.ts`), so the bytes come off disk with no network, but the state does not
survive the unmount, so a revisit re-enters the `undefined` branch and paints the
skeleton again for content that is already local. A module-level `Map<url, html>` shared
across mounts makes back-navigation paint instantly. Content addressed by `storageId` is
immutable by construction, so the cache needs no invalidation rule, which is what makes
this cheap.

**Going forward could cost nothing at all and currently costs both trips.**
`nextLessonKey` is already threaded into `LessonView`, and the forward path is how the
reader is actually used. A `useQuery` for the next lesson (Convex holds the subscription,
so the click resolves from cache) plus a bare `fetch` of its `contentUrl` to prime the
HTTP cache turns the common navigation into no network at all.

Blocked by 03 rather than merely sequenced after it, for two reasons worth stating so the
edge can be re-cut if it turns out to be wrong: the forward-warm win stays masked while
the RSC round trip is still in front of it, and both tickets edit the same reader
components, so running them in parallel invites a collision on the highest-traffic
surface in the app.

Things to decide rather than assume:

- **How much to warm.** One lesson ahead is the obvious answer. Warming the whole course
  would turn a course open into thirty subscriptions and thirty blob fetches, which
  trades a perceived win for a real cost on a metered mobile connection. Justify the
  number chosen.
- **Whether the cache needs a ceiling.** Bodies are HTML strings and a long session
  across a large course accumulates them. It may genuinely not matter; say so with a
  size, rather than leaving it unconsidered.
- **What warming does to the paygate.** A `preview` caller must not end up prefetching a
  locked body. The server already refuses (`readLesson` projects the paygate), so the
  warm should return nothing useful, but confirm it rather than trusting it.

**This is not offline reading.** `technical-foundation/05` grills persistent offline
content under a lease, and its whole subject is revocation on a device that is never
online. This cache persists nothing and dies with the tab, so that objection does not
reach it. Do not let the two merge.

## Done when

- Returning to a previously-read lesson paints its body with no skeleton.
- Moving to the next lesson costs no network on a warm cache, confirmed in devtools.
- A `preview` caller prefetches no locked content.
- Walked in a browser, and the Answer distinguishes that from reading the code.
