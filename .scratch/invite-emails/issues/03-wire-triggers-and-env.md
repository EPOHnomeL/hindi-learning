# invite-emails/03: wire triggers + env vars

**Status:** done
**Depends on:** 01, 02

## Why

Connect the sender to the invite flow so real invites and role changes send
email, and document/set the deployment config.

## Scope

- **`shareTopic`** ([`convex/shares.ts`](../../../convex/shares.ts)): on **every**
  call (incl. re-invites), after resolving the branch, schedule
  `internal.email.sendInvite` via `ctx.scheduler.runAfter(0, …)`:
  - existing user → `kind: "granted"`, link = `${APP_BASE_URL}/courses/<slug>`
    + `?lang=<code>` when non-English (mirror `withLang`).
  - no account → `kind: "invited"`, link = `${APP_BASE_URL}/`.
  - payload also carries `courseTitle` (`topic.title`), `langName`
    (`langInfo(editionLang).name`, or "English"), `inviterEmail` (the caller's
    `users.email`), `role` (`"viewer"` — invites start as Viewer).
- **`setShareRole`**: when the patched row is an **accepted** Share (the `person`
  branch that found a `share`), schedule `sendInvite` with `kind: "role-changed"`
  and the new role + deep link. When it patches a **pending** invite, schedule
  **nothing**.
- **`revokeShare`**: unchanged (no email).
- **Env** — add to `.env.example` and set on the Convex deployment:
  `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `APP_BASE_URL`. `APP_BASE_URL` can be
  set now (the app origin); the Resend values are user-supplied.
- Add `internal` import to `shares.ts` if not present.

## Out of scope

- Renderer/action internals (issue 02).

## Acceptance criteria

- Inviting an existing user schedules a `granted` email with the course deep
  link; inviting a no-account email schedules an `invited` email with the sign-up
  link; both carry course title, language name, inviter, role.
- Promoting/demoting an **accepted** Share schedules a `role-changed` email with
  the new role.
- Role change on a **pending** invite and `revokeShare` schedule no email.
- Invites/role changes still succeed if scheduling/sending would fail (best-effort).

## Tests (TDD, `convexTest`, inspect scheduled functions)

1. `shareTopic` (existing user) schedules `sendInvite` with `kind:"granted"` and
   the expected payload/link.
2. `shareTopic` (no account) schedules `kind:"invited"` with the sign-up link.
3. Non-English Edition → link carries `?lang=<code>`.
4. `setShareRole` on an accepted Share schedules `kind:"role-changed"` with the
   new role.
5. `setShareRole` on a pending invite schedules nothing.
6. `revokeShare` schedules nothing.
