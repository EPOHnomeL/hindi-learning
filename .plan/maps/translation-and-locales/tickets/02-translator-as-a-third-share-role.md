---
type: task
blocked_by: []
---
# Add translator as a third Share role

## Question

`shares.role` is `viewer | editor`, and [ADR 0020](../../../docs/adr/0020-editor-rights-as-a-share-role.md)
is emphatic that Editor is "a role *on* a Share, not a second grant". A Translator
needs the same shape, and needs to be **distinguishable** from an Editor: an editor
grant might mean "can fix typos", whereas the report's **Busy** rung has to mean "this
person was appointed to translate this language and has an account".

Add `translator` as a third value, and decide what it grants.

Recommended: **translator implies editor's write access, plus the payee marker**. A
translator who cannot edit the text cannot translate it. What it must *not* grant is
anything else owner-only (sharing, public links, firing the Routine, completing).

Sites that read or write the role, from a grep:

- `convex/schema.ts` (both `shares` and `pendingShares`)
- `convex/lib.ts` — `shareRole()` and the `canEdit` derivation at line 178
- `convex/shares.ts` — the share/invite mutations at 213 and 252
- `convex/email.ts:31` and `convex/inviteEmail.ts` — `access()` and `roleNoun()`, so
  the invite email says the right word
- `convex/editor-role.test.ts` and the invite-email tests

Write the **ADR** as part of this ticket: it extends ADR 0020 rather than superseding
it, and the thing worth recording is *why* a third role beat reusing `editor` (the
derived **Busy** rung would otherwise be ambiguous, and the revenue share needs an
unambiguous holder).

## Done when

- `role` is `viewer | editor | translator` on both `shares` and `pendingShares`,
  optional as today so absent still reads as `viewer` with no migration.
- `canEdit` treats `translator` as write-capable; nothing else changes.
- The invite email names the role correctly for a translator invite.
- A new ADR in `docs/adr/` records the third role and its reasoning, referencing
  ADR 0020 without rewriting it.
- The **Translator** glossary entry in `CONTEXT.md` is checked against what shipped and
  corrected if this ticket deviated.
- `pnpm typecheck` and `pnpm test` green, with the existing editor-role tests extended
  rather than replaced.

<!-- Moved 2026-09-01 from translator-status-report/02 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history.  -->
