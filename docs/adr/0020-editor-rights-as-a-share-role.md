# Editor rights as a role on a Share

## Status

accepted

## Context

Sharing was read-only by design: a **Share** granted a **Viewer** read access to
one **Edition** (a Topic × language), and every write — including the owner
hover-pencil prose edits ([course-content-editing](../../.scratch/course-content-editing/PRD.md))
— resolved through `getOwnedTopic`, owner-only. We now want owners to let
specific people **correct the text** of specific Editions (e.g. a native-Urdu
speaker fixing the Urdu edition), without making them co-owners and without
opening editing to every Viewer.

## Decision

Editing rights are a **role on the existing Share row**, not a new grant or
table. `shares` and `pendingShares` gain `role?: "viewer" | "editor"` (absent =
Viewer). The grain is unchanged — one grant per (person, Edition) — so a person
can be Editor of one Edition and Viewer of another on the same Topic.

- **Scope is exactly the owner's hover-pencil prose edits**, nothing more: an
  Editor may edit Lesson/Reference bodies of the one Edition granted to them
  (`editLesson`/`editReference` for an English-edition Editor;
  `editTranslatedLesson` for a translated-edition Editor), under the same
  quiz-structure guard, live with no draft gate. All other powers — delete,
  Mission, sharing, Public links, Routine firing, translate, complete, Emblem,
  deleting the Topic — stay owner-only.
- **Owner grants only.** `shareTopic` still creates a Viewer; a separate
  owner-only mutation flips an existing Share's role. Editors cannot promote
  anyone (no transitive delegation).
- **Enforcement moves to a new resolver**, `getEditableTopic(userId, slug, lang)`
  = owner OR holder of an editor-Share for that lang. The content-edit mutations
  switch from `getOwnedTopic` to it; owner-only mutations keep `getOwnedTopic`.
  The reader's `canEdit` becomes a server-computed per-Edition capability instead
  of the client's `!readOnly`.
- Pending invites carry the role through `claimPendingShares`, so an
  invited-but-unregistered email can be pre-set as Editor.

## Considered options

- **A separate `editorGrants` table.** Rejected: editing rights share the exact
  (person, Edition) grain as a Share, and would duplicate the pending-invite /
  claim-on-signup machinery for no benefit.
- **Owner + editors can delegate.** Rejected: transitive grants make revocation
  and intent murky; owner-only keeps the authority model trivial.
- **Broader "co-owner" scope** (delete, Mission, Routine, complete). Rejected for
  now: prose-editing is the concrete need; a larger blast radius (delete cascades
  Responses/Progress/Questions) isn't warranted yet.

## Consequences

- The glossary's long-standing "a Share never confers write access" is retired;
  **Share**, **Viewer**, and the new **Editor** term are updated in `CONTEXT.md`.
- The owner gains a per-Edition **access roster** (accepted + pending) with a
  Viewer/Editor toggle and revoke — the first owner-facing "who has access" and
  "remove access" surface, which sharing lacked entirely.
- An English-edition Editor's edit to a source Lesson makes translated Editions
  stale (`sourceHash` drift) exactly as an owner's own source edit does today —
  no new behaviour.
