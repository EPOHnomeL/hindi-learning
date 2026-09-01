---
type: task
blocked_by: [01, 02]
---
# Appoint a translator from the Editions panel

## Question

**Corrected 2026-09-01: the panel this ticket names no longer exists.**
`src/app/_components/Editions.tsx` was **deleted** by
[`ui-overhaul/19`](../../ui-overhaul/tickets/19-build-editions-sharing.md), along with
`EditionsDialog`, when management became the route `/courses/[slug]/manage`. Its
replacement is the **Sharing tab** (`src/app/_components/manage/SharingTab.tsx`),
which is per Edition and is the only tab the edition button shows on. The selector
belongs there. Everything else below still holds: `translate.editions`
([`convex/translate.ts:1073`](../../../convex/translate.ts)) survived the move
untouched and still returns one row per language with `lang` / `name` / `native`, and
that row is still where an owner should pick the translator, as an explicit role
beside view and edit.

Note also that the **access roster moved off the per-Edition panel** onto the
course-scoped Users tab (`ui-overhaul/17`), with language as a row attribute. So
"appoint on the language row" and "manage people on the Users tab" are now two
different surfaces, and this ticket should check that its selector is still on the
right one before building it.

Build the selector. **One selector, two writes** (map Notes): appointing someone
upserts the tenant's `translators` row *and* issues the `role: "translator"` Share on
that Edition.

The wrinkle to handle honestly: the roster is keyed **(tenant, language)** while the
panel is scoped to one course. So appointing the Afrikaans translator from
`prophetic-school` sets a **tenant-wide** fact. Either say so in the UI or make the
control read as tenant-scoped; do not let it look course-local when it is not.

Two states the panel must render, because the roster and the grant can disagree:

- a roster row with no grant (**Rostered**, or **Invited** if a `pendingShares` row
  exists) — the useful, actionable state
- a `role: "translator"` Share with no roster row — appointed outside the panel, and
  the panel should offer to reconcile rather than hide it

Who may do this: the **owner**, per the charting grill. The tenant's *rate* is a
separate decision under 09 and is not set here.

**Why this still matters after 2026-09-01:** the weekly report was ruled out, but the
roster is now read by
[`ui-overhaul/26`](../../ui-overhaul/tickets/26-dashboard-editor-progress-table.md),
the editor-by-language table on the owner's Dashboard. This selector is still the only
way a name gets into that table.

## Done when

- A translator selector on each language row of the Editions panel, showing the current
  translator or its absence, with its tenant-wide scope legible.
- Appointing performs both writes atomically enough that a failure cannot leave a grant
  with no roster row.
- Both disagreement states above render, and neither is silently dropped.
- Owner-only, enforced server-side, not just hidden in the UI.
- `pnpm typecheck` and `pnpm test` green.
- Walked in a browser against a real Edition, not just read. Say which in the Answer.
