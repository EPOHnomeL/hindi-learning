---
type: task
blocked_by: [01, 02]
---
# Appoint a translator from the Editions panel

## Question

[`src/app/_components/Editions.tsx`](../../../src/app/_components/Editions.tsx) is the
owner's per-language panel, fed by `translate.editions`
([`convex/translate.ts:1073`](../../../convex/translate.ts)), which already returns one
row per language with `lang` / `name` / `native`. That row is where an owner should pick
the translator, as an explicit role beside view and edit.

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

## Done when

- A translator selector on each language row of the Editions panel, showing the current
  translator or its absence, with its tenant-wide scope legible.
- Appointing performs both writes atomically enough that a failure cannot leave a grant
  with no roster row.
- Both disagreement states above render, and neither is silently dropped.
- Owner-only, enforced server-side, not just hidden in the UI.
- `pnpm typecheck` and `pnpm test` green.
- Walked in a browser against a real Edition, not just read. Say which in the Answer.
