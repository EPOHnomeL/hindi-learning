# Public link shares (anonymous, read-only Topic links)

> **Narrowed by [ADR 0028](0028-landing-interest-list-first-public-mutation.md)
> (2026-08-07).** The Decision below states "there are _no_ public mutations."
> That is now scoped to the **content graph** — still exactly true of everything a
> Guest can reach — but the landing interest list added one public mutation
> outside it. The decision text stands as written; read 0028 for the narrowing.

A Topic owner can mint an unguessable **Public link** that lets *anyone* — with
no account — read the whole Topic on the web. This is a second, capability-based
form of read access alongside the existing account-bound **Share**, and it
reverses two decisions previously written into `CONTEXT.md`.

## Context

[ADR 0001]/the topic-sharing PRD established read access as **account-bound**: a
**Share** is granted to a known **Viewer** by email, and the glossary explicitly
listed "public link" under `Share`'s _Avoid_ and defined a `Viewer` as one who
"must have an account (distinct from a guest)." Anonymous links were called out
as deferred. [ADR 0012](0012-app-router-url-addressable-navigation.md) then
reserved an ungated `/share/[token]` route outside the `(app)` auth group so this
feature would need no auth-gate carve-out — but shipped nothing behind it.

The ask: let an owner share a course publicly, read-only, without the recipient
needing an account. That breaks the account-bound assumption head-on, so the
trade-offs (concept identity, what's exposed, the token model, and the read
path) deserve recording.

## Decision

- **A Public link is a *new, parallel* concept — not an overloaded Share.**
  `Share`/`Viewer` stay exactly as they are (targeted, account-bound). The token
  form gets its own vocabulary: a **Public link** (the capability) held by a
  **Guest** (anonymous reader). "Share" is never used for the public form, and
  "Publish" stays reserved for the teach→Hub push. See `CONTEXT.md`.
- **A Guest sees the full mirror** — Lessons, References, Resources, *and the
  owner's Questions, Replies, and Progress* — read-only. On a public Topic the
  creator's Q&A is treated as a feature (a Guest learns from the questions the
  creator already asked), not a leak. A future per-Topic opt-out (e.g. "don't
  share my questions") is deferred to `.scratch/topic-sharing/issues/08`.
- **One token per Topic, stored as an optional `publicToken` field on `topics`**
  (+ a `by_public_token` index), not a separate relation. 256-bit random
  (hex via Web Crypto `getRandomValues`), never derived from the slug. "Make public" mints it;
  "Regenerate" overwrites it; **"Turn off" clears the field** — so off means
  *truly revoked* and re-enabling later mints a brand-new link. No "disabled but
  remembered" state.
- **Reads go through a parallel, token-authorized seam** (`convex/public.ts`),
  queries only — authorizing by token, never by `getAuthUserId`. A missing or
  invalid token returns uniform `null`/`[]` (no "this Topic exists" signal). The
  Guest page passes the URL token to live `useQuery` calls, so revoking a link
  makes an open Guest tab go dead on the next tick. Row-shaping is shared with
  the authed reader queries so the two can't drift.
- **Write-blocking is structural:** there are *no* public mutations. A Guest has
  nothing to call — no Progress, Responses, or Questions of their own. Quizzes
  stay interactive in-iframe (self-check) but nothing is recorded.
- **The route mirrors the authed reader under the token** —
  `/share/[token]` (→ first Lesson), `/share/[token]/lessons/[key]`,
  `/share/[token]/references/[key]` — so Guest navigation keeps ADR 0012's
  deep-linking/back-forward behaviour. Owner controls live in the existing
  `SharePanel` as a distinct "Public link" section, with a plain enable-time
  disclosure (anyone with the link sees lessons, resources, **and your questions
  & progress**). Any signed-in user opening a share URL sees the Guest view, so
  the owner previews exactly what the public sees.

## Considered Options

- **Overload `Share`/`Viewer`** (a "link kind" of Share, a split Viewer) —
  unifies the read seam but dissolves two currently-sharp terms (account-bound,
  targeted). Rejected: the public form is genuinely a different relationship
  (anonymous, capability-based), so a parallel concept is clearer.
- **Narrower Guest scope** (Lessons + References only, hiding Q&A/Progress) —
  safer default for a forwardable credential, but the owner wants the creator's
  Q&A *visible* as shared-learning value. Rejected as the default; preserved as a
  future opt-out (issue 08).
- **A `shareLinks` relation / multiple revocable tokens** — more flexible
  (per-audience links), more schema + UI. Rejected for v1's one-link-per-Topic.
- **Proxy resource blobs through a token-checked HTTP endpoint** for instant
  revocation — tighter, but a new `httpAction`, content-type handling, and no CDN
  caching. Rejected for v1: signed URLs are short-lived, so the residual access
  is bounded (see Consequences).
- **Single-page Guest view** (client-side lesson selection, no per-lesson URL) —
  fewer files, but regresses to the pre-ADR-0012 world. Rejected.

## Consequences

- **Reverses documented vocabulary:** `Share`'s _Avoid: public link_ and
  `Viewer`'s _account-required_ lines are updated; "public link" and "guest"
  become first-class terms (`Public link`, `Guest`).
- **Signed-URL revocation gap (accepted):** a Guest who has already fetched a
  Resource's signed blob URL keeps that one blob until the URL expires, even
  after the link is turned off. Revocation is immediate for the page and all new
  access; this residual is bounded by the signed-URL lifetime and documented.
- **Token leakage is the owner's risk:** the token lives in the URL (browser
  history, server logs, and — mitigated by `rel="noreferrer"` +
  `Referrer-Policy: no-referrer` — `Referer`). Standard for "anyone with the
  link" systems. Brute-forcing 256 bits is infeasible, so no rate-limiting in v1.
- **Privacy posture:** going public exposes personal learning data (Q&A,
  Progress) by design, mitigated by the enable-time disclosure and the deferred
  opt-out (issue 08).
