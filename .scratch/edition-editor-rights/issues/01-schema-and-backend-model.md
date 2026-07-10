# 01 — Schema + backend model for the Editor role

Status: ready-for-agent

Parent: [PRD](../PRD.md) · [ADR 0020](../../../docs/adr/0020-editor-rights-as-a-share-role.md)

## Goal

Introduce the Editor role at the data layer and the shared resolver, with no
behaviour change to existing callers. Everything defaults to Viewer, so no
migration is needed.

## Scope

- **Schema** (`convex/schema.ts`): add
  `role: v.optional(v.union(v.literal("viewer"), v.literal("editor")))` to both
  `shares` and `pendingShares`. Update the surrounding comments to note the role.
- **`convex/lib.ts`:**
  - `shareRole(doc)` helper — `doc.role ?? "viewer"` — mirroring `shareLang`.
  - `getEditableTopic(ctx, userId, slug, lang?)` — the write-side sibling of
    `getViewableTopic`: returns the Topic if `topic.ownerId === userId`, else if
    the caller holds a Share on `(topic._id, lang ?? SOURCE_LANG)` whose
    `shareRole` is `"editor"`; otherwise `null`. Match lang in-memory over
    `by_topic_viewer` (legacy rows carry no lang), consistent with
    `viewerLangs`.
  - `claimPendingShares`: carry `invite.role` (default viewer) onto the inserted
    `shares` row.

## Acceptance

- `npx convex codegen` types clean; existing Share reads unaffected (absent role
  = viewer everywhere).
- Unit/convex-test coverage: `getEditableTopic` returns the Topic for the owner,
  for an editor-Share holder of the requested lang, and `null` for a Viewer, a
  wrong-lang editor, and a stranger. `claimPendingShares` on a pending invite
  with `role: "editor"` yields a Share with `role: "editor"`.

## Notes

Pure model layer — do **not** touch any mutation's guard here (issue 02) or add
UI. This issue must leave all current behaviour identical.
