# invite-emails/02: invite email renderer + Resend sender action

**Status:** done
**Depends on:** —

## Why

We need a testable way to turn an invite into an email, and a way to actually
send it, without a network call in the hot path or in tests.

## Scope

- **Pure renderer** — new dependency-free module `convex/inviteEmail.ts`
  exporting `renderInviteEmail(kind, data)` → `{ subject, html, text }`.
  - `kind`: `"granted"` (existing user) | `"invited"` (no account) |
    `"role-changed"`.
  - `data`: `{ courseTitle, langName, inviterEmail, role, link }`.
  - Rich content: subject + body name the course, Edition language, inviter, and
    the recipient's role, and include the link (button in html, bare URL in
    text). No server imports — importable in a plain vitest test.
- **Sender action** — `internalAction` `sendInvite` in new `convex/email.ts`:
  - Args: `{ to, kind, courseTitle, langName, inviterEmail, role, link }`.
  - Reads `RESEND_API_KEY` + `INVITE_FROM_EMAIL` from env; if either is unset,
    `console.warn` and return (no-op — feature ships before the account exists).
  - Builds the Resend payload from `renderInviteEmail` and `fetch`es
    `POST https://api.resend.com/emails` with
    `Authorization: Bearer <key>`. Default runtime (no `"use node"`).
  - Best-effort: on non-2xx or thrown error, `console.error` and return — never
    throw.

## Out of scope

- Wiring it into `shareTopic` / `setShareRole` (issue 03).
- Retries, idempotency, delivery tracking.

## Acceptance criteria

- `renderInviteEmail` returns correct subject/body/link per kind.
- `sendInvite` POSTs the rendered email to Resend when env is set; no-ops when
  it isn't; never throws.

## Tests (TDD)

Pure (`convex/inviteEmail.test.ts`, no network):
1. `granted` → subject/body include course title, language name, inviter, role;
   link is the deep link passed in.
2. `invited` → body invites account creation; link is the sign-up URL passed in.
3. `role-changed` → body states the new role.

Action (`convexTest`, `fetch` stubbed via `vi.stubGlobal`):
4. With env set, `sendInvite` calls `fetch` once with the Resend URL, bearer
   header, and a body containing the rendered subject + recipient.
5. With `RESEND_API_KEY` unset, `fetch` is not called and it doesn't throw.
6. On a stubbed non-2xx response, it doesn't throw.
