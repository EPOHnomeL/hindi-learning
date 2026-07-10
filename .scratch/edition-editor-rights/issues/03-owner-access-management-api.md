# 03 — Owner access-management API (roster, role, revoke)

Status: ready-for-agent

Parent: [PRD](../PRD.md) · depends on [01](01-schema-and-backend-model.md)

## Goal

Give the owner the backend to see who has access to an Edition and to change
roles or revoke — the first owner-facing share-management surface.

## Scope — new functions in `convex/shares.ts` (all owner-guarded via `getOwnedTopic`)

- **`listEditionAccess({ topicSlug, lang })`** — query. Returns the roster for
  one Edition: an array of `{ email, role, status }` where `status` is
  `"accepted"` (from `shares`, joined to `users.email`, matched on
  `shareLang === lang`) or `"pending"` (from `pendingShares` for
  `(topic, lang)`). Role via `shareRole`.
- **`setShareRole({ topicSlug, email, lang, role })`** — mutation. Finds the
  matching Share for `(topic, viewer(email), lang)` and patches `role`; if none
  but a matching pendingShare exists, patches that. Idempotent; throws if neither
  exists. `role` is `"viewer" | "editor"`.
- **`revokeShare({ topicSlug, email, lang })`** — mutation. Deletes the matching
  Share **or** pendingShare for `(topic, email, lang)`. Idempotent (no-op if
  already gone).

All three normalise the email (`normaliseEmail`) and resolve the Topic with
`getOwnedTopic`, so a non-owner is rejected before touching data.

## Acceptance (convex-test, extend `sharing-readonly.test.ts`)

- Owner: `listEditionAccess` returns accepted + pending entries with correct
  roles and statuses for the requested lang only.
- Owner: `setShareRole` promotes a Viewer→Editor and demotes back; works on a
  pending invite too.
- Owner: `revokeShare` removes an accepted Share and (separately) a pending
  invite; second call is a no-op.
- A non-owner calling any of the three is rejected.
- Isolation: `setShareRole` on lang A leaves the same person's Share on lang B
  unchanged.

## Notes

No UI here (issue 04). Keep lang-matching in-memory over `by_topic_viewer` /
`by_topic_email` to handle legacy rows with no `lang`, matching `shareTopic`.
