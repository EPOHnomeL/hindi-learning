---
type: grilling
blocked_by: [04]
---
# Offline Lesson content, under a lease

## Question

Should a learner be able to read Lessons with no connection - and if so, what makes a revoked
Entitlement stop working on a device that is never online?

Split out of [02](../../reader-experience/tickets/02-download-course-for-offline.md) on 2026-08-23, when the installable-app
grilling scoped offline down to lists only
([ADR 0030](../../../../docs/adr/0030-installable-per-tenant-app.md) §3). Lists were
decided there and are not built yet either; content was not decided at all. This ticket is the
deferred half, and the grilling that produced it established three things worth not re-deriving.

**1. The access objection was aimed at the wrong target.** The standing reason not to cache content
was that it puts *"a copy of paid content on a device an Entitlement revocation cannot reach"*. But
`GET /content?id=<storageId>` (`convex/http.ts`) already serves Lesson bodies with **no
authentication**, `Access-Control-Allow-Origin: *` and `max-age=31536000, immutable`. Every learner
who has opened a Lesson already holds a permanent, revocation-proof, world-readable URL to it. So
caching does not *introduce* the exposure - it makes it convenient. The exposure itself is
[marketplace/12](04-content-route-is-an-open-bearer-url.md).

**2. Encryption is not the answer, and this was tested properly.** WebCrypto makes AES-GCM trivial,
so the crypto is the easy part - and it buys nothing. The key must reach the device, the plaintext
must render in a browser the learner controls, and the key ends up in their IndexedDB. It would be
strictly weaker than the `/content` URL they can already save. Precisely: **encryption without a
lease delivers zero revocation; a lease without encryption delivers revocation within one lease
period.** The lease is the whole mechanism; encryption is an optional anti-casual-copying layer on
top of it.

**3. The expensive part is the writes, not the reads.** Rendering a Lesson offline is nearly free -
`lessonSrcDoc.ts` notes lessons *"stay self-contained with no API calls of their own"*, the quiz
being authored markup read by an injected bridge. But that bridge `postMessage`s the learner's
answer to the parent, which writes it to Convex, and **first-answer-only is enforced server-side**.
So offline answers have to queue and reconcile, and a replayed answer has ordering consequences
against a rule that assumes it saw the first attempt. Same for Progress. This is the real cost of
the ticket and the reason it is not a caching change.

So the open questions are: what the lease period is and what renewal looks like; whether a lease
is worth anything at all while `/content` stands open (does marketplace/12 block this?); how queued
Responses reconcile against first-answer-only; whether Progress and Responses queue by the same
mechanism; and whether the whole thing is worth it for a learner base whose lifetime sales are
around ten.

## Done when

The offline-content want is grilled into a decision - lease period and renewal, the Response and
Progress queue's reconciliation rule, and its dependency on marketplace/12 settled - and either
implementation tickets exist or the ticket is ruled out with the reason recorded.

<!-- Moved 2026-09-01 from `reader-experience/05` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 05 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
