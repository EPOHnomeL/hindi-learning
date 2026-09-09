---
type: grilling
blocked_by: [01]
---
# Should the first paint come from the server?

## Question

Every authed surface in the app is client-rendered against Convex, so a cold load is a
strictly serial chain: HTML, then JS parse and execute, then the Convex websocket
handshake, then the auth token exchange that `AppGate`'s `AuthLoading` is waiting on,
then the first query, then paint. Four sequential waits before a learner sees a word.

The skeletons make this civil rather than broken, and that is exactly why it has never
been challenged. But no skeleton is as good as content.

`convex/nextjs` exports `preloadQuery`, and **the pattern is already proven in this
tree**: the course layout calls `fetchQuery(api.content.reader.topicTenant)` server-side
for the cross-host canonical redirect (`courses/[slug]/layout.tsx`). So the plumbing
works here; what is unknown is whether it can carry the reader and the dashboard.

The open questions, none of which have obvious answers:

- **Auth on the server.** `preloadQuery` needs the caller's identity to return
  owner-scoped content, and every reader query starts with `getAuthUserId`. Convex Auth
  ships a Next server integration and the middleware already runs it, so a token should
  be reachable, but a preload that silently resolves as signed-out would render an
  empty dashboard before the client corrects it, which is worse than a skeleton.
- **Matching the client's arguments exactly.** The reader's queries are keyed on
  `lang`, which is resolved through a chain of locale hints (URL, stored preference,
  the served Edition, `Accept-Language`) partly in middleware and partly in the client
  (`useEditionLang`). A preload that guesses a different `lang` than the client then
  subscribes with is not a cache hit; it is a double fetch and a visible content swap.
  **This is the question most likely to sink the whole idea, so answer it first.**
- **What happens to `AppGate`.** It renders `AuthLoading`, `Unauthenticated` and
  `Authenticated` as three branches, and the signed-out branch is load-bearing: a
  `/courses/*` deep link falls through to the public Guest reader. Server-preloaded
  content has to slot into that without breaking the deep-link behaviour that ADR 0012
  and the 2026-09-08 public-course change both depend on.
- **Whether it is worth it at this scale.** This is the largest structural change on the
  map. Ticket 01's field numbers exist to say whether cold start is actually where
  learners are losing time, or whether the reader's per-click cost (tickets 03 and 05)
  is the whole story. **That is why this ticket is blocked on 01 rather than merely
  sequenced after it.**

If the answer is yes, it is almost certainly more than one session and wants its own
implementation tickets, sliced by surface (dashboard first, reader second) rather than by
layer.

## Done when

The question is answered against the field numbers from [01](01-field-measurement-for-the-reader.md),
and either:

- Implementation tickets are filed on this map, sliced by surface, with the `lang`
  resolution question settled in writing before any of them can start.
- Or the ticket is closed with `## Ruled out` recording what the field data said about
  cold start and why the serial chain is being left alone.
