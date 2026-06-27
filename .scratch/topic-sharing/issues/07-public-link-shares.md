# 07 — Public read-only link shares (anonymous Viewers)

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md) — this lifts the "Anonymous / public links" item out of that PRD's **Out of Scope**.

## Want

Let an owner share a Topic via an **anonymous link** that anyone can open
read-only, without an account. Today a **Share** is account-bound: `shareTopic`
resolves an email against `users` and only the matching signed-in **Viewer** can
read it. This adds a second, capability-based form: a link carrying an
unguessable **token** grants read-only access to whoever holds it.

Surfaced during the App Router routing work (see the `url-routing` feature /
PRD): the routing design reserves an **ungated** `/share/[token]` route outside
the authed `(app)` route group precisely so this can be built without an auth
gate in the way. This issue is the backend + read-only view behind that route.

## Open questions (needs a design pass — grill before building)

- **Concept naming.** The glossary's **Share** explicitly lists `_Avoid_: public
  link`. Is a link-share a second *kind* of Share, or a new top-level term
  (e.g. **Public link** / **Link share**)? CONTEXT.md must be reconciled — this
  reverses a documented decision and likely warrants an ADR (it was a real
  trade-off the topic-sharing PRD called out as deferred).
- **Token model.** One token per Topic, or many (revocable individually)? Stored
  where — a field on `topics`, or a new `shareLinks` relation? How is it minted,
  rotated, revoked? Unguessable (random, not derived from `slug`).
- **Scope of a public Viewer.** The PRD's account-Viewer sees Lessons,
  References, Resources, the owner's Questions/Replies, and Progress. Does an
  anonymous holder see the same set, or a narrower one (e.g. Lessons +
  References only, no Questions/Progress)?
- **Backend read path.** Auth-scoped reader queries can't serve an unauthenticated
  caller. Needs token-authorized read functions that authorize via the token
  instead of the signed-in user — a parallel read seam to the owner-or-Viewer
  resolver.
- **Granularity.** Link to a whole Topic only, or also deep-link to a single
  Lesson (`/share/[token]/lessons/[key]`)?
- **Write-blocking.** Anonymous holders write nothing (no Progress, no Questions,
  no Resources) — same load-bearing server-side guarantee as account-Viewers.

## Depends on

- `url-routing` feature — the public `/share/[token]` route lands as part of that
  work; this issue fills it with real data.
- Builds on the `shares` read-gate widening from **01**.

## Notes

- Anti-enumeration matters more here than for account-shares: a token is the
  whole credential, so it must be long and random, and revocation must be real.
