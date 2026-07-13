# PRD: Editor rights per Edition

Status: ready — grilled and agreed; see [ADR 0020](../../docs/adr/0020-editor-rights-as-a-share-role.md).

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Edition**
> (a Topic × language), **Share**, **Viewer** (read-only role), **Editor** (a
> Share promoted to write access), **owner**, **Guest**. Decision recorded in
> [ADR 0020](../../docs/adr/0020-editor-rights-as-a-share-role.md). Builds
> directly on [course-content-editing](../course-content-editing/PRD.md) (the
> owner hover-pencil edits an Editor inherits) and the per-Edition
> Share/pending-Share model (`convex/shares.ts`, `convex/lib.ts`).

## Problem Statement

An owner shares an Edition with someone who could improve it — a native speaker
who spots a clumsy Urdu translation, a colleague who notices a typo in the
English source. Today that person is a **Viewer**: strictly read-only. The only
way to get a fix in is for the owner to make every correction themselves. There
is **no way to let a specific person edit a specific Edition**. Separately, once
an owner has shared a course they have **no view of who has access and no way to
revoke** it — sharing is fire-and-forget.

## Solution

Add an **Editor** role to the Share. An owner promotes a person's Share on one
Edition from Viewer to Editor; that person then gets the **same hover-pencil
prose editing** the owner already has, scoped to that one Edition. Everything
else stays owner-only.

- **Role on the Share, not a new grant.** `shares` and `pendingShares` gain
  `role?: "viewer" | "editor"` (absent = Viewer). One grant per (person,
  Edition); promoting = flipping the field. A person can be Editor of one
  Edition and Viewer of another on the same Topic.
- **Editor scope = owner's pencil, that Edition only.** An English-edition
  Editor edits source Lesson and Reference bodies (`editLesson` /
  `editReference`); a translated-edition Editor edits that Edition's translated
  Lesson bodies (`editTranslatedLesson`). Same quiz-structure guard, same
  immediate no-draft visibility. **Not** granted: delete Lesson, Mission,
  sharing, Public links, Routine firing, translate, complete, Emblem, Topic
  delete — all remain owner-only.
- **Owner grants only.** `shareTopic` still creates a Viewer. A new owner-only
  mutation sets a Share's role. Editors cannot promote anyone (no delegation).
- **Access roster.** The owner gets a per-Edition list of everyone with access
  — accepted Shares **and** pending invites — each with a **Viewer/Editor
  toggle** and a **revoke** control. Pending invites take the same controls; the
  role rides through claim-on-signup.
- **Enforcement server-side.** A new resolver `getEditableTopic(userId, slug,
  lang)` = owner OR holder of an editor-Share for that lang. The content-edit
  mutations switch from `getOwnedTopic` to it. The reader's edit affordance is
  driven by a **server-computed per-Edition `canEdit`**, not the client's
  `!readOnly`.

## User Stories

### Owner — granting and managing access
1. As an owner, I want to see everyone I've shared an Edition with — accepted and pending — in one place, so that I know who has access.
2. As an owner, I want to promote a person's Edition access from Viewer to Editor with a single toggle, so that a trusted person can help fix the text.
3. As an owner, I want to demote an Editor back to Viewer, so that I can withdraw editing rights without removing their access entirely.
4. As an owner, I want to revoke a person's access to an Edition outright, so that I can remove someone who should no longer see it.
5. As an owner, I want to set the role of, and revoke, a **pending** invite (an email with no account yet), so that I don't have to wait for them to sign up to manage them.
6. As an owner, I want promoting one person on one Edition to leave their (and others') access to other Editions untouched, so that rights stay per-Edition.

### Editor — editing a granted Edition
7. As an Editor of the English edition, I want the hover pencil to appear on Lessons and References, so that I can correct the text exactly where I read it.
8. As an Editor of a translated edition, I want the pencil on that Edition's Lessons, so that I can fix a mistranslation in place.
9. As an Editor, I want my save to be blocked if it changes a quiz's structure, identically to the owner, so that I can't break scoring.
10. As an Editor, I want my saved edit to go live to all readers immediately, so that editing behaves the same as the owner's.
11. As an Editor, I want to see **no** owner-only affordances (delete, share, Mission, fire, translate, complete), so that my rights are clearly scoped to prose.

### Authorization
12. As a Viewer who has **not** been promoted, I want no pencil and a rejected edit mutation, so that read-only stays read-only.
13. As an Editor of Edition A, I want to be unable to edit Edition B I only hold as a Viewer, so that rights don't leak across Editions.
14. As a Guest on a Public link, I want no editing affordance at all.
15. As the system, I want every content-edit mutation to reject a caller who is neither owner nor editor-of-that-Edition, so that authorization never depends on the UI hiding a control.
16. As the system, I want only the owner to be able to set roles or revoke, so that an Editor cannot escalate or delegate.

## Implementation Decisions

- **Schema.** Add `role: v.optional(v.union(v.literal("viewer"), v.literal("editor")))`
  to `shares` and `pendingShares`. Absent reads as `"viewer"` — no migration;
  every existing Share stays a Viewer. A `shareRole(doc)` helper mirrors the
  existing `shareLang(doc)` (absent → `"viewer"`).

- **New resolver `getEditableTopic(ctx, userId, slug, lang)`** in `lib.ts`,
  the write-side sibling of `getViewableTopic`: returns the Topic if
  `ownerId === userId`, else if the caller holds a Share on `(topic, lang)` with
  role `editor`; otherwise null. Lang defaults to `SOURCE_LANG` for the
  English-only paths.

- **Edit mutations switch guards.** `editLesson` (source, lang = en),
  `editReference` (source, en), and `editTranslatedLesson` (explicit lang)
  resolve the Topic via `getEditableTopic` with the right lang instead of
  `getOwnedTopic`. Their internal target/apply helpers (which currently re-run
  `getOwnedTopic` / owner checks) use the same editable check. **No other
  mutation changes** — `deleteLesson`, rename, Mission, share, public, translate,
  complete, Emblem keep `getOwnedTopic`.

- **New owner-only mutations in `shares.ts`:**
  - `setShareRole({ topicSlug, email, lang, role })` — owner-guarded via
    `getOwnedTopic`; sets the role on the matching Share **or** pendingShare for
    `(topic, email, lang)`. Idempotent.
  - `revokeShare({ topicSlug, email, lang })` — owner-guarded; deletes the
    matching Share or pendingShare for `(topic, email, lang)`.

- **New owner-only query `listEditionAccess({ topicSlug, lang })`** in
  `shares.ts` — owner-guarded; returns the roster for one Edition: each entry
  `{ email, role, status: "accepted" | "pending" }`. Accepted entries join
  `shares → users.email`; pending entries come from `pendingShares`.

- **`claimPendingShares` preserves role.** When a pending invite becomes a real
  Share on sign-up, copy its `role` onto the inserted `shares` row (default
  viewer). The existing dedup stays per `(topic, viewer, lang)`.

- **Reader `canEdit` is server-driven.** The content query that feeds the reader
  returns a per-Edition `canEdit` boolean (owner, or editor of the served lang),
  computed with the same `getEditableTopic` logic. `ArtifactView` /
  `CourseShell` read that flag instead of deriving `canEdit = !readOnly`.
  References keep their English-only constraint (`canEdit && lang is en`).

- **UI — access roster.** Extend the per-Edition sharing surface in
  `Editions.tsx` (below `InviteByEmail`): a list of `listEditionAccess` entries,
  each with a Viewer/Editor segmented toggle (`setShareRole`) and a small revoke
  control (`revokeShare`). Pending entries render with a "pending" marker but the
  same controls. Owner-only — the panel already renders only for the owner.

## Testing Decisions

- **convex-test at the mutation/query seams** (extend `sharing-readonly.test.ts`
  and `content.test.ts`): seed owner + Topic + Lessons/References/translations +
  a Viewer Share with `t.run`, act as each caller via `withIdentity`.
  - **Role grant/revoke:** owner promotes a Viewer to Editor and back
    (`setShareRole`); owner revokes (`revokeShare`); a non-owner calling either
    is rejected. Pending-invite variants: set role / revoke a pendingShare;
    `claimPendingShares` yields a Share with the preserved role.
  - **Enforcement:** an Editor of the English edition can `editLesson` /
    `editReference`; an Editor of a translated edition can
    `editTranslatedLesson`; the read seam then returns the new body. A plain
    Viewer, an Editor of a *different* Edition, and a Guest are **rejected** by
    each edit mutation. The quiz-structure guard still fires for an Editor.
  - **Roster read:** `listEditionAccess` returns accepted + pending entries with
    correct roles for the owner and is rejected for a non-owner.
  - **Isolation:** promoting a person on Edition A leaves their role on Edition B
    unchanged; the English source is untouched by a translated-edition Editor's
    edit.
- **No automated frontend test** — the roster toggle and the editor's pencil are
  verified by eye, consistent with prior reader-UI features.

## Out of Scope

- **Broader Editor powers** — delete Lesson, Mission, Routine firing, translate,
  complete, Emblem, Topic delete stay owner-only (ADR 0020).
- **Editor-set-at-share-time** — sharing always creates a Viewer; promotion is a
  separate step (grilled decision).
- **Transitive delegation** — Editors cannot grant or change roles.
- **Edit attribution / history / audit trail** — edits stay silent and
  immediate, exactly as the owner's do today. No "edited by X" marker.
- **Concurrent-edit conflict handling** — last write wins, as today; Convex
  reactivity pushes the result.
- **Translated-Reference editing** — References remain English-source-only, so a
  translated-edition Editor edits only Lessons.

## Suggested Issue Breakdown

1. **Schema + backend model** — `role` on `shares`/`pendingShares`,
   `shareRole` + `getEditableTopic` helpers, `claimPendingShares` preserving
   role. Tests for the resolver.
2. **Editor enforcement on edit mutations** — switch `editLesson` /
   `editReference` / `editTranslatedLesson` (and their helpers) to
   `getEditableTopic`; server-computed `canEdit` in the reader content query.
   Enforcement + isolation tests.
3. **Owner access-management API** — `listEditionAccess`, `setShareRole`,
   `revokeShare`. Grant/revoke/roster tests.
4. **Access roster UI + editor pencil visibility** — the roster in `Editions.tsx`
   (toggle + revoke, pending entries) and the reader reading server `canEdit`.
