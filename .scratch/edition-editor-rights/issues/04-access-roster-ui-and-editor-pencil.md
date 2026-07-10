# 04 — Access roster UI + editor pencil visibility

Status: ready-for-agent

Parent: [PRD](../PRD.md) · depends on [02](02-editor-enforcement-on-edit-mutations.md), [03](03-owner-access-management-api.md)

## Goal

Wire the owner's access roster into the sharing UI and let an Editor actually see
the hover pencil on their Edition.

## Scope

- **Access roster in `Editions.tsx`.** Under `InviteByEmail` for each Edition,
  render `listEditionAccess({ topicSlug, lang })`: one row per person showing the
  email, a **Viewer/Editor** segmented toggle (calls `setShareRole`), and a
  small **revoke** control (calls `revokeShare`). Pending entries show a "pending
  — joins when they sign up" marker but keep the same two controls. Owner-only —
  this panel already renders only for the owner. Reactive (live query), optimistic
  is not required.
- **Editor pencil visibility.** `ArtifactView` / `CourseShell` already gate the
  pencil on `canEdit`; change the source of `canEdit` from the client's
  `!readOnly` to the **server `canEdit`** returned by the content query (issue
  02). References keep their English-only rule (`canEdit && (lang == null || lang
  === "en")`).

## Acceptance (by eye — no component test infra)

- As owner: the roster lists accepted people and pending invites; toggling
  Viewer↔Editor and revoking both take effect live; changing one Edition doesn't
  disturb another.
- As an Editor of an Edition: the pencil appears on that Edition's Lessons
  (and References if English) and saving works; owner-only affordances (delete,
  share panel, fire, translate, complete) do **not** appear.
- As a plain Viewer: no pencil anywhere.
- As a Guest (public link): no pencil.

## Notes

Match the existing `Editions.tsx` visual language (the `InviteByEmail` /
`PublicLinkToggle` styling). Keep copy plain: "Can view" / "Can edit" on the
toggle reads better than "Viewer" / "Editor" for a lay owner — use whichever
fits the surrounding UI, the domain term is Editor/Viewer.
