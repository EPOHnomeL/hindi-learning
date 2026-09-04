---
type: grilling
blocked_by: []
---
# The /content route is an open bearer URL

## Question

Is it acceptable that every Lesson body is readable forever by anyone holding its URL, with no
session and no Entitlement?

Found 2026-08-23 while grilling the installable-app effort, which needed to know what offline
caching would expose and discovered the exposure already exists.

`GET /content?id=<storageId>` (`convex/http.ts`) returns a Lesson or Reference body with:

- **no authentication of any kind** - the handler reads the `id` param and returns the blob
- `Access-Control-Allow-Origin: *`
- `Cache-Control: public, max-age=31536000, immutable`

The paygate lives entirely at the *query that hands out the storage id* (`readLesson` and friends,
behind `resolveEdition` and the Entitlement checks). Once the id has been handed over, the content
is public. The design intent is stated plainly in `convex/contentBlobs.ts:18`: *"The storageId is
an unguessable bearer capability; callers only reach this after the query has authorized them."*
(Corrected 2026-09-04: this line pointed at `convex/lib.ts`, which no longer exists. Ticket 16
moved the content blob helpers, and that sentence with them, into `contentBlobs.ts`; ticket 17
then renamed what was left of `lib.ts` to `edition.ts`, which is where `readLesson` and
`resolveEdition` live now.)

So this is **deliberate**, not an oversight, and unguessable-id-as-capability is a real pattern.
The question is whether its consequences are still the ones you want, because they are stronger
than "unguessable" suggests:

- A learner who buys a course, reads it, and is **refunded keeps permanent read access** to every
  Lesson they opened. Revoking the Entitlement changes nothing about the URLs they hold.
- A learner can **share those URLs** with anyone. No session, no CORS restriction, no referer
  check, cacheable for a year - they work from any origin, including a page someone else hosts.
- The ids are stable and immutable ([ADR 0003](../../../../docs/adr/0003-immutable-lessons-mutable-references.md)), so
  there is no natural rotation that would eventually invalidate a leaked URL.
- **Browser history, shared devices and copy-paste** all leak the capability in ordinary use, since
  the URL is fetched by the reader client and is visible in devtools.

Worth weighing honestly against the counter-arguments, which are not weak: the ids are genuinely
unguessable; the blast radius of one leaked URL is one Lesson, not a course or an account; no
customer has complained; lifetime sales are around ten; and the `public, immutable` caching is a
real performance benefit that any fix gives up.

Options a grilling would price: leave it and record the acceptance explicitly; short-lived signed
URLs minted per request (loses the year-long cache, and the reader would need to re-mint); an
authenticated content route (a session check per Lesson fetch, and a CORS decision); or scoping
the capability by wrapping the id in a token that carries an expiry.

Note the dependency: **[reader-experience/05](05-offline-lesson-content-under-a-lease.md)
may be blocked on this.** A time-boxed lease on offline content is theatre if the underlying
content route hands out permanent access anyway - so decide this first, or decide deliberately that
the lease is worth having regardless.

## Done when

The exposure is either accepted with the reasoning and date recorded, or a fix is chosen and its
implementation tickets exist - including what it costs in caching and what the reader client has to
change.

<!-- Moved 2026-09-01 from `marketplace/12` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 04 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->

## Evidence, gathered 2026-09-04

The premise was confirmed against **production**, not reasoned about. Reading a
lesson on `ywampotch.my-course.app` puts exactly one content request on the wire:

```
https://capable-barracuda-769.eu-west-1.convex.site/content?id=<storageId>
```

That URL was then fetched from a fresh `curl`, outside the browser, with **no
cookies, no session and no headers of any kind**. It returned `200`, 27197 bytes
of `text/html`, the complete lesson body. Possession of the id is the whole
authorisation, exactly as the design intent says.

Two honest limits on this evidence, so nobody over-reads it:

- The lesson used was the **free preview lesson**, which anyone may read anyway.
  So this demonstrates the mechanism, NOT a paywall bypass. Proving the stronger
  claim needs a paid lesson's id, which needs a purchase.
- It says nothing about how long an id stays valid, because one fetch cannot show
  that. The `storage.getUrl` links are noted elsewhere as permanent
  (`docs/agents/project-context.md`), which is the thing to check next.

What this does settle is that the question is real and current: the endpoint is
open today, on prod, and the id is a bearer capability in the plainest sense.
