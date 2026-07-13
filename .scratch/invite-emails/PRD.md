# PRD: Invite emails — notify people when they're invited to an Edition

Status: implemented (2026-07-13) — tests green; delivery pending Resend domain + env vars

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md): **Share**, **Viewer**,
> **Editor**, **Edition**, pending **invite**, **Allowlist**. No ADR: the one
> real trade-off (best-effort send via a plain action + fetch, instead of the
> durable `@convex-dev/resend` component) is cheap to reverse — the provider is a
> ~15-line island in `email.ts`; adopt the component later without touching the
> renderer or the trigger sites.

## Problem Statement

Inviting someone to an Edition is silent. The owner types an email in the
"Editions & sharing" panel and… nothing reaches the person. They only discover
the share if they happen to log in and notice it. Worse, for an email with **no
account**, the modal promises *"They're in the moment they sign up"* — but that's
a lie today: sign-up is **Allowlist-gated** ([`convex/auth.ts:39`](../../convex/auth.ts#L39)),
and creating a pending invite ([`convex/shares.ts`](../../convex/shares.ts))
never adds the email to the `whitelist` table. So a no-account invitee **cannot
sign up at all** — the invite is a dead letter until an Admin separately admits
them.

## Solution

Two changes, one feature:

1. **Inviting unlocks sign-up.** `shareTopic` also admits the invited email to
   the Allowlist, so the "they're in when they sign up" promise becomes true. The
   existing `claimPendingShares` flow then turns the pending invite into real
   access on sign-up.
2. **Inviting sends an email.** Every invite submission emails the recipient —
   an *"access granted"* email to someone who already has an account (deep-linked
   to the Edition), or an *"invited — create your account"* email to someone who
   doesn't (linked to sign-up). Every role change (view↔edit) on an **accepted**
   Share emails the new role.

Email is **best-effort**: the invite (the DB row + Allowlist unlock) always
succeeds; the email is a separate action scheduled after commit, and a provider
failure is logged, never surfaced as an invite error.

## Decisions (from grilling)

- **Auto-admit.** `shareTopic` calls `admitEmail` for the invited address (both
  the existing-user and no-account paths). Idempotent; a no-op for someone
  already admitted. Revoke does **not** un-admit (admitting is monotonic — the
  email may hold other invites or have already signed up).
- **Provider: Resend + a verified domain.** The From address lives on a domain
  verified in Resend (SPF/DKIM) for good deliverability. (Earlier explored a
  single-sender provider to avoid DNS; the owner opted to get a domain instead.)
- **Mechanism: plain Convex `internalAction` + `fetch`** to Resend's REST API
  (`POST https://api.resend.com/emails`). No `"use node"` — `fetch` works in the
  default Convex runtime. No new dependency. Upgrading to the durable
  `@convex-dev/resend` component later is a localized change at the action.
- **Best-effort send.** Scheduled with `ctx.scheduler.runAfter(0, …)` after the
  mutation commits. On a non-2xx / thrown error the action `console.error`s and
  returns; the invite is unaffected. No retry, no idempotency key (the owner can
  just re-invite, which re-sends).
- **Triggers:**
  - **Every invite submission** (incl. re-invites → re-sends):
    - recipient **has an account** → *access-granted* email, link to
      `${APP_BASE_URL}/courses/<slug>[?lang=<code>]`.
    - recipient **has no account** → *invited* email, link to `${APP_BASE_URL}/`
      (sign-up; `claimPendingShares` grants access on sign-up).
  - **Every role change** on an **accepted** Share (view↔edit) → *access-changed*
    email stating the new role. **Pending** invitees are **not** emailed on role
    change (they haven't signed up; they already got the invite email; their role
    is carried through at sign-up regardless).
  - **Revoke** → no email.
- **Rich content.** Course title (base English `topics.title`), Edition language
  name (`langInfo(lang).name`), inviter email, the recipient's role, and the
  link.
- **New Convex env vars** (deployment env, *not* Vercel — Convex functions can't
  read Vercel's env):
  - `RESEND_API_KEY` — the Resend API key.
  - `INVITE_FROM_EMAIL` — the From address on a domain verified in Resend. The
    project domain is `my-course.app` (Cloudflare), e.g.
    `"Y-Knot Courses <invites@my-course.app>"`.
  - `APP_BASE_URL` — the web app origin for links (Vercel today:
    `https://my-course-learning-five.vercel.app`).
  - If `RESEND_API_KEY` / `INVITE_FROM_EMAIL` are unset, the action logs and
    no-ops (so the feature ships before Resend is configured).

## User Stories

1. As a no-account invitee, when I'm invited I get an email that lets me create
   an account and land in the shared Edition — so the invite actually reaches me.
2. As an existing user, when I'm given access I get an email that deep-links me
   straight into the Edition.
3. As an invited person, my email names the course, the Edition language, who
   invited me, and my access level — so I can place the invite.
4. As an owner, when I invite someone with no account, they can now actually sign
   up (the invite admits them) — the "they're in when they sign up" promise holds.
5. As an owner, re-inviting someone re-sends their email — so I can nudge a
   person who missed the first one.
6. As a person whose role is changed from Viewer to Editor (or back), I get an
   email telling me my new access level.
7. As an owner, an invite never fails just because email delivery hiccups — the
   share is created regardless.

## Implementation Decisions

- **`admitEmail` becomes shared.** It's currently module-private in
  [`convex/whitelist.ts`](../../convex/whitelist.ts). Export it (plain helper
  over `MutationCtx`) and call it from `shareTopic`. No scheduling — it runs in
  the same mutation ctx, atomic with the invite.
- **Pure renderer, thin action.** A dependency-free module
  `convex/inviteEmail.ts` exports `renderInviteEmail(kind, data)` →
  `{ subject, html, text }` for the three kinds (`granted` | `invited` |
  `role-changed`). Unit-tested directly (mirrors `lessonSrcDoc.ts`). The
  `internalAction` `email.sendInvite` reads env, builds the Resend payload from
  the renderer, and `fetch`es — the only impure part.
- **Trigger sites pass a ready payload.** `shareTopic` and `setShareRole` compute
  everything the email needs (recipient, kind, course title, language name,
  inviter email, role, link) and schedule `internal.email.sendInvite` with it, so
  the action needs no DB reads — pure env + fetch.
- **Link building** mirrors [`editionUrl.ts`](../../src/app/_components/editionUrl.ts)
  `withLang`: English adds no `?lang=`.

## Testing Decisions

- **Seam: the Convex function API** via `convexTest`, plus **pure unit tests** on
  the renderer — matching the repo (`content.test.ts` for the seam,
  `lessonSrcDoc.test.ts` for pure helpers).
- **Auto-admit** — after `shareTopic` to a no-account email, `isEmailAdmitted`
  returns true, and that email can then complete sign-up and claim its pending
  Share (the end-to-end "they're in when they sign up" path).
- **Renderer** — each kind produces the right subject, contains the course title,
  language name, inviter, role, and the correct link (English vs `?lang=` deep
  link vs sign-up root). Pure, no network.
- **Trigger wiring** — `shareTopic` (existing + no-account) and `setShareRole`
  (accepted only) schedule `internal.email.sendInvite` with the expected payload;
  `setShareRole` on a **pending** invite and `revokeShare` schedule **nothing**.
  Asserted by inspecting scheduled functions in `convexTest`.
- **Send action** — with `fetch` stubbed, `sendInvite` POSTs to the Resend URL
  with the rendered body; with env unset it no-ops without throwing. No live
  network in tests.
- **No frontend tests** — consistent with the repo. The panel copy already
  reflects the pending flow.

## Out of Scope

- **Durable delivery** — best-effort send only; adopting the
  `@convex-dev/resend` component (queued retries + idempotency) is a later,
  non-breaking swap at the action.
- **Retries / durable queue** — best-effort only; re-invite is the manual retry.
- **Un-admitting on revoke** — admitting is monotonic.
- **Emailing pending invitees on role change** — deferred by decision.
- **Email on revoke, on public-link changes, or a digest** — none.
- **Delivery/open tracking, unsubscribe management** — transactional invites only.

## Further Notes

- Almost entirely backend: one exported helper, one pure renderer module, one
  internal action, and scheduling calls added to two existing mutations. No
  schema change, no migration.
- **Delivery caveat:** the code ships regardless, but nothing delivers until the
  owner verifies a domain in Resend and sets `RESEND_API_KEY` +
  `INVITE_FROM_EMAIL` (and `APP_BASE_URL`) in the Convex deployment env.
