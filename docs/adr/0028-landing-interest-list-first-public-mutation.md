# The landing interest list, and the first public mutation

> Written 2026-08-07, alongside the landing-page restructure that introduced it.
> The brief was spoorpet.com, a pre-product interest page that converts strangers
> with one field and one button; the operator asked for the same second
> conversion on `my-course.app` and `ywampotch.my-course.app`.

## Status

Accepted 2026-08-07. **Narrows** [ADR 0013](0013-public-link-shares.md)'s
"there are no public mutations" invariant — which was platform-wide in practice
and is now explicitly scoped to the content graph. Supersedes nothing.
[ADR 0027](0027-per-tenant-donation-rail.md)'s "the donor is a Guest, with no
email field" is untouched: that is the *donation widget*, which still asks for no
address. This is a separate form with a separate purpose.

## Context

Both landing pages had exactly one conversion: sign in. A visitor who isn't ready
to make an account has nothing to do but leave, and we never learn they came.
The ask was to add the fallback the brief does well — one field, one button, an
email address — while keeping sign-in as the primary action, because unlike
spoorpet.com we have something to sell today.

An interest list is inherently an **anonymous write**. There is no way to record
"a stranger left their address" without a stranger writing a row. That collides
head-on with ADR 0013, whose Decision reads:

> **Write-blocking is structural:** there are _no_ public mutations.

ADR 0013's own scope was the Guest/public-link read seam — the sentence is about
what a Guest holding a share token may do. But it hardened into a platform-wide
invariant, and ADR 0027 deliberately designed around it, recording that the
guarantee "survives intact." Adding the first public mutation without saying so
would leave that claim stranded and false for the next reader, so it is written
down here instead.

## Decision

### The invariant is narrowed, not abandoned

ADR 0013's rule now reads, explicitly: **there are no public mutations on the
content graph.** A Guest still has nothing to call — no Progress, Responses,
Questions, or any write that touches a Topic, Lesson, Edition, Entitlement or
Ledger row. That is the guarantee that was load-bearing, and it is intact.

`interest.register` sits entirely outside that graph. It writes one row on one
table that nothing else reads, joins, or grants from.

### A lead grants nothing

The `interestLeads` row is a marketing list and only ever that: no account, no
Entitlement, no access, no `users` row. This is the same reasoning ADR 0027 used
to let an anonymous donor through ADR 0021's auth-first rule — that rule exists so
an Entitlement can attach to an account, and there is no Entitlement here for it
to have an opinion about.

### The write cannot accrue rows

The abuse surface ADR 0027 avoided by persisting nothing is instead **bounded by
idempotency**: `register` is idempotent per `(email, tenantSlug)`, patching
`submissions` and `lastSubmittedAt` rather than inserting. One address is one row
forever, however many times the button is pressed. The table therefore grows with
*distinct addresses offered*, not with requests received — which is the property
that made "no public mutations" worth having.

Deliberately **not** a rate limiter, and not a captcha. Both are real
infrastructure answering a problem the idempotency already bounds; if unique-address
spam ever becomes real, a limiter is the fix and this is the note that predicted it.

### Everything an anonymous caller can influence is bounded in one file

- `email` — validated server-side (shape and a 254-character RFC 5321 cap) and
  normalised through the existing `normaliseEmail`, so casing and whitespace can't
  split one person into two rows. The form validates too, but that check is for the
  visitor's benefit; the server's is the gate.
- `source` — a **closed union**, not `v.string()`. This field exists so the
  operator can tell which CTA converted, and an open field makes that number
  untrustworthy the moment anything writes an unplanned value, besides handing an
  anonymous caller a place to stuff arbitrary text.
- `tenantSlug` — scopes the list per site. The same address on two tenants is two
  leads, because a lead on `ywampotch.my-course.app` belongs to that ministry.

There is no free-form field on the table and no way to add one from the client.

### Reading the list is Admin-only and scoped

`listLeads` gates on the existing `isCallerAdmin(ctx, tenantSlug)`, so a sys admin
reads any tenant's list and a tenant admin reads exactly their own. The rows are
**row-shaped** on the way out rather than returned whole, so a field added to the
table later cannot leak by accident. `register` returns `null` — a caller learns
only that it worked, which is also all the success card says.

## Considered Options

- **An `httpAction` in `convex/http.ts` instead of a mutation.** The file already
  accepts an unauthenticated external write (the PayFast ITN), so this would have
  let the letter of "no public mutations" stand. Rejected as laundering: the abuse
  surface is identical and the invariant would have been technically-true and
  practically-misleading, which is worse than narrowing it in writing.
- **A Next.js route handler calling an `internalMutation`.** Genuinely keeps the
  invariant and adds a place to rate-limit at the edge. Rejected for v1: the app
  has no route handlers and no server-side Convex client today, so this introduces
  a whole new tier — plus a deploy key in the environment — to guard a write that
  idempotency already bounds.
- **No email capture; sign-in only.** The status quo, and the cheapest option.
  Rejected because it was the thing being asked for: a visitor not ready to make
  an account is currently a total loss.
- **Capture on the donation widget instead**, reusing the anonymous-query rail.
  Rejected: it conflates giving money with wanting updates, and ADR 0027's
  no-email-field decision is deliberate and still right for that widget.

## Consequences

- `interest.register` is the one public mutation in the codebase. It should stay
  the one; a second should have to argue with this document first.
- ADR 0013's Decision text still says "there are _no_ public mutations." Per the
  repo's rule an ADR is never rewritten to correct it — **this ADR is the
  narrowing**, and a reader who lands on 0013 first should be pointed here.
- `convex/donations.ts` carries a comment asserting ADR 0013's guarantee "survives
  intact." That was true when written (2026-08-01) and is true *of the donation
  rail* still, but the platform-wide reading of it is now out of date; the comment
  is updated to say so and to point here.
- The operator has no UI for the list yet — `listLeads` exists and the admin
  portal does not call it. Leads are readable from the Convex dashboard until it
  does, which is enough while the list is small and is the honest state to record
  rather than imply a screen exists.
