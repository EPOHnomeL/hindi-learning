# `unlimited` lifts the volume caps; Admin stays a separate grant

The two per-user daily caps on generation volume, `content.seedTopic`'s
one-new-course-per-day and `routine.tryAcquireGeneration`'s
one-manual-fire-per-day, now ask a new question, `isCallerUncapped`, instead of
`isCallerAdmin`. It is true for an Admin of either tier (unchanged behaviour) and
for any Allowlist row carrying the new `unlimited: true` column. Nothing else
about admin-ness moves: the `/admin` route, its nav link, the Allowlist editor,
the fire-and-pray driver and every `requireAdmin` boundary keep gating on
`isAdmin` alone.

## Context

Both caps were introduced by whitelabel issue 08 to bound runaway Claude spend by
an unknown account, and both exempted the Admin for the same stated reason: the
Admin drives the app and is not the risk being guarded against. That was a
reasonable shortcut while the only trusted account WAS the Admin.

It stops being reasonable as soon as a second person needs to author at volume.
There was exactly one way to lift a cost cap, `isAdmin: true`, and it also handed
over the Allowlist editor (add and remove any email, including the ability to lock
the operator out down to the last-sys-admin guard), the tenant panels, the
generation history for every course in the deployment, and the fire-and-pray
driver. "Let this person seed as many courses as they like" and "make this person
an administrator" were one decision, and the only way to grant the first was to
grant the second.

The caps themselves are not the problem and are not being relaxed for anyone
else. The problem is that the *exemption* was welded to a role.

## Decision

- **A new column, not a new role.** `whitelist.unlimited: v.optional(v.boolean())`
  sits beside `isAdmin` and `tenantSlug` on the row that already answers "may this
  email create courses at all". Absent reads as capped, so every existing row is
  unaffected.
- **One question, asked at both cap sites.** `whitelist.isCallerUncapped(ctx)`
  returns true for `isAdmin` (either tier) or `unlimited`. Both caps call it.
  Identity is derived server-side from the forwarded identity, never a client
  argument, exactly as `isCallerAdmin` is.
- **Both caps, not one.** A grant that lifted the course cap but left the manual
  fire cap in place would let someone seed ten courses and then advance one lesson
  per day across all of them, which is not the thing being granted.
- **Granted by operator CLI only.** `npx convex run whitelist:seedEmail
  '{"email":"…","unlimited":true}'`. There is deliberately no Admin-panel toggle:
  lifting a cost cap on someone else's account is an operator decision, and the
  panel has no way to record who asked for it or why.
- **Admit never revokes.** `admitEmail` only ever moves `isAdmin` / `unlimited`
  from absent to true, so a bare `addEmail` on an existing row cannot quietly
  demote anyone. Removing either flag is `removeEmail` plus a re-admit, or a
  direct operator run.

## Consequences

- An `unlimited` member can spend Claude budget without a ceiling. That is the
  point of the grant, and it is why the grant is CLI-only and per-email rather
  than a role anyone with the panel can hand out.
- `isCallerAdmin` remains the answer to every authorization question. Only the two
  volume caps changed what they ask, so there is no new path into admin-only data.
- The Admin exemption is now expressed as one case of a broader rule rather than
  as the rule itself. A future third tier of trust extends `isCallerUncapped`, not
  the cap sites.
- Nothing surfaces the flag in the UI: an `unlimited` row looks like an ordinary
  member row in the Allowlist editor. Adding a read-only marker there is the
  obvious follow-up if the grant is ever used more than a handful of times.
