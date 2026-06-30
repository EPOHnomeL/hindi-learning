# 07 — Public link shares (anonymous Guests)

Status: done (commits 6f61050 backend — schema `publicToken`, `setTopicPublic`,
the token-authorized `convex/public.ts` read seam; d99ff56 frontend —
`/share/[token]` Guest reader + SharePanel Public-link controls + Public badge;
e574d75 review fixes — route `no-referrer`, public-query return validators,
identity-agnostic read test). TDD'd at the Convex seam; passed a Standards+Spec
review. Designed in the 2026-06-30 grill; foundational choices in
[ADR 0013](../../../docs/adr/0013-public-link-shares.md) and the **Public link** /
**Guest** terms in [`CONTEXT.md`](../../../CONTEXT.md). Follow-up: issue 08
(per-Topic privacy controls).

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Public link**, **Guest**). Spec: [`../PRD.md`](../PRD.md) — lifts the "Anonymous / public links" item out of that PRD's **Out of Scope**.

## Want

Let an owner mint an unguessable **Public link** that lets anyone open a Topic
read-only, with no account. This is a second, capability-based form of read
access alongside the account-bound **Share**: a token *is* the credential, and
its anonymous holder is a **Guest**. Fills the ungated `/share/[token]` route
that [ADR 0012](../../../docs/adr/0012-app-router-url-addressable-navigation.md)
reserved (the route was never built — this issue stands it up).

## Acceptance

- **Token on the Topic.** An optional `publicToken` field on `topics` + a
  `by_public_token` index. Minted with the Web Crypto API (256-bit, hex,
  not slug-derived). One token per Topic.
- **Owner mutations (owner-only):** `makeTopicPublic` mints/sets the token,
  `regeneratePublicLink` overwrites it (old link dies at once), `makeTopicPrivate`
  clears it. "Off" forgets the token; re-enabling mints a fresh one.
- **Token-authorized read seam** in `convex/public.ts` (queries only — no public
  mutations): `publicCourse`, `publicLessons`, `publicLesson`, `publicReferences`,
  `publicReference`, `publicResources`, `publicProgress`, `publicQuestions`. Each
  takes the `token`, resolves the Topic via `by_public_token`, and returns the
  same shapes as the authed reader (share the row-shaping helpers). An invalid or
  absent token returns uniform `null`/`[]` — never reveals a Topic exists.
- **Full mirror.** A Guest sees Lessons, References, Resources, and the owner's
  Questions/Replies and Progress — read-only (per ADR 0013; opt-out is **08**).
- **Ungated route mirroring the authed reader:** `/share/[token]` (→ first
  Lesson), `/share/[token]/lessons/[key]`, `/share/[token]/references/[key]`,
  *outside* the `(app)` group. Guest chrome is minimal (title + read-only reader,
  no sign-out / no dashboard link / no sign-up CTA). Quizzes stay interactive but
  record nothing. `rel="noreferrer"` on outbound links + `Referrer-Policy:
  no-referrer` on the route.
- **Owner UI:** a "Public link" section in the existing `SharePanel` (alongside
  the email-Share section) — a toggle that mints + shows the copyable URL, plus
  Regenerate and Turn off, and a plain enable-time disclosure ("anyone with this
  link can see this course's lessons, references, resources, and your questions &
  progress — no account needed"). A **"Public" badge** on the owner's dashboard
  card while a link is live. Any signed-in user opening a share URL sees the Guest
  view (owner preview).
- **Tests (Convex seam):** a Guest read works with a valid token and returns
  `null`/`[]` for a wrong/cleared token; regenerate invalidates the old token;
  turning private kills access; there are no public mutations to write with.

## Decisions & deliberate non-goals (from the grill)

- **Signed-URL gap (accepted):** `publicResources` hands a Guest a signed blob
  URL that outlives revocation until it expires. Bounded and documented (ADR
  0013); a token-checked blob proxy is out of scope.
- **One link per Topic** — a `shareLinks` relation / multiple revocable links is
  out of scope.
- **No rate-limiting** — a 256-bit token makes brute force infeasible.
- **No per-facet privacy control** — full mirror is the default; the opt-out is
  **08**.

## Depends on

- Builds on the `shares` read-gate widening from **01–05** (the owner-or-Viewer
  resolver and the row shapes the public reads mirror).
- The ungated route seam from ADR 0012.
