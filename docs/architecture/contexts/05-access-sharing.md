---
slug: access-sharing
name: Access & Sharing
position: 5
status: draft
adrs: [0011, 0013, 0015, 0017, 0020]
---

# Access & Sharing

Independent gates: **who may sign up** (the [[Allowlist]], governed by one [[Admin]] —
[ADR 0011](/docs/adr/0011-allowlist-in-convex-admin-portal.md)), **who may read an [[Edition]] they
don't own** ([[Share]]s — [[Viewer]] or [[Editor]] — and account-less [[Public link]]s for [[Guest]]s),
and the [[Certificate]] a completed course earns. Sharing governs reads/edits; the allowlist governs
sign-up.

## Allowlist (sign-up gate)

The backend is [whitelist.ts](/convex/whitelist.ts). Emails are normalised (trim + lowercase) on both
store and lookup ([`normaliseEmail`](/convex/whitelist.ts#L12-L14)), so every check is a plain equality
on `by_email`. The one admission decision is
[`isEmailAdmitted`](/convex/whitelist.ts#L19-L25) — **an empty table admits nobody** (closed by design).

The Admin (an account whose email has an `isAdmin` whitelist row) manages it through Admin-only
functions, each guarded by [`requireAdmin`](/convex/whitelist.ts#L59-L70):
[`list`](/convex/whitelist.ts#L73-L81), [`addEmail`](/convex/whitelist.ts#L104-L113),
[`removeEmail`](/convex/whitelist.ts#L119-L133). [`amIAdmin`](/convex/whitelist.ts#L86-L100) backs the
`/admin` route guard (UX only — the real boundary is `requireAdmin` on every call). First-row bootstrap
is [`seedEmail`](/convex/whitelist.ts#L138-L145) via `npx convex run`.

The gate is **live**: [auth.ts](/convex/auth.ts) checks the `whitelist` table from the
`createOrUpdateUser` callback (not `profile()`, which Password doesn't await), and **only on account
creation** — an existing account signs in untouched. An un-admitted email is rejected with "This
workspace is private — sign-ups are closed." The one-time `migrateFromEnv` seeded the table from the
retired `AUTH_ALLOWED_EMAILS` env var. A NOTE in the file warns that adding a `reset`/`verify` provider
would bypass the gate.

## Sharing (read gate)

The read-side authorization lives in one helper —
[`getViewableTopic`](/convex/lib.ts#L31-L40): return the Topic if the caller **owns** it, else if a
`shares` row matches `(topicId, viewerId)` on `by_topic_viewer`. Every content read query
(`listLessons`, `getLesson`, `listReferences`, `getReference`) routes through it. Writes route through
`getOwnedTopic` instead, so a Viewer is read-only by construction — the one exception is
`setProgress`, which routes through `getViewableTopic` so a Viewer tracks their **own** Progress.

[shares.ts](/convex/shares.ts): the owner calls [`shareTopic`](/convex/shares.ts) naming the Topic, the
recipient's **email**, and a language. It grants access to one **[[Edition]]** (Topic × language,
[ADR 0020](/docs/adr/0020-editor-rights-as-a-share-role.md)) and, so a not-yet-registered invitee can
actually sign up, **admits the email to the Allowlist**. If the account exists it inserts a `shares`
row ("shared"); if not, a `pendingShares` row ("pending") that becomes a real Share automatically on
sign-up ([`claimPendingShares`](/convex/lib.ts) inside the auth callback). So an invite is no longer a
dead letter — but it still does not *bypass* the Allowlist, it opens it for that one email.

**Roles ([ADR 0020](/docs/adr/0020-editor-rights-as-a-share-role.md)).** A Share is created as a
**[[Viewer]]** (read-only) and can be promoted to **[[Editor]]** (`setShareRole`). An Editor may correct
the *text* of the one Edition granted to them — [`getEditableTopic`](/convex/lib.ts) authorises the
in-place hover-pencil edit for the owner **or** an editor-Share on that exact language (an editor-Share
for lang X never authorises lang Y). Everything else stays owner-only. `revokeShare` /
`listEditionAccess` manage the roster; [`listSharedTopics`](/convex/shares.ts) powers the Viewer's
"Shared with me" feed, grouping several Editions of one Topic into one card.

A Viewer **can** read all Lessons/References and track their **own** Progress (starting clean on a
shared Topic); a Viewer **cannot** edit the Mission, rename, add Resources, ask Questions, record
Responses, fire the Routine, or re-share. An Editor adds *only* in-place text edits on their Edition.

## Public links & Guests

[`setEditionPublic`](/convex/shares.ts) mints/regenerates a per-Edition token in `publicLinks`
([ADR 0013](/docs/adr/0013-public-link-shares.md)); `true` always mints fresh (serving both "make
public" and "regenerate"), `false` revokes. The legacy per-Topic `topics.publicToken` is still honoured
as the English link, so old links survive. The read side is [public.ts](/convex/public.ts): a [[Guest]]
reaches `publicCourse`/`publicLesson`/`publicReference` by token only, each with an **explicit output
allowlist**; a missing token returns a uniform null (no enumeration). `/share/[token]` sets
`robots:noindex` + `referrer:no-referrer` so the token doesn't leak via `Referer`.

## Certificates

[certificates.ts](/convex/certificates.ts) has two auth models: authed owner-or-Viewer (`myCertificate`,
`claimCertificate`) and anonymous token-only (`publicCertificate`, output-allowlisted to the achievement
only). Eligibility is **derived, never stored** ([`isEligible`](/convex/certificates.ts)): the Topic is
`completed` and the caller completed every non-superseded Lesson (reusing `topicLessonCounts` so it can't
drift from the progress bar). `claimCertificate` is idempotent and snapshots
`learnerName`/`courseTitle`/`lessonCount`/`lang`/[[Emblem]] frozen at issue
([ADR 0015](/docs/adr/0015-course-completion-and-certificates.md), [ADR 0017](/docs/adr/0017-topic-emblem-on-certificates.md)).

## Invite emails

`shareTopic`/`setShareRole` schedule [`internal.email.sendInvite`](/convex/email.ts) **after commit**, so
a slow or failing send never blocks the grant. [inviteEmail.ts](/convex/inviteEmail.ts) is a pure,
dependency-free renderer (kinds: `granted`, `invited`, `role-changed`); [email.ts](/convex/email.ts)
sends via Resend and **no-ops with a warning if `RESEND_API_KEY`/`INVITE_FROM_EMAIL` are unset**
(ship-before-configured).

## Gotchas

- **Sign-up gate ≠ session gate.** Removing an email blocks *new* sign-ups only; existing accounts keep
  their access and can still sign in ([whitelist.ts:117](/convex/whitelist.ts#L115-L133)).
- **The Admin row can't be removed** — [`removeEmail`](/convex/whitelist.ts#L129) refuses it, so the
  Admin can't lock themselves out. There is exactly one Admin.
- **Inviting a stranger works now.** No account → a `pendingShares` row + the email admitted to the
  Allowlist; it forms a real Share on sign-up. (Earlier the docs said this was impossible — it isn't.)
- **Read-gate and write-gate are independent.** Viewer read-only is enforced because writes use
  `getOwnedTopic`; per-Edition text edits go through `getEditableTopic`. `canEdit`/`canWrite` only hide
  the UI — the real boundary is the server helper.
- **Lang matching is in-memory, not indexed.** Legacy `shares`/`pendingShares` rows carry no `lang`, so
  Edition matching (and dedup) is done in code, defaulting absent → `en`/`viewer`. `getViewableTopic`
  uses `.first()` not `.unique()` because a Viewer may now hold several Editions of one Topic.
