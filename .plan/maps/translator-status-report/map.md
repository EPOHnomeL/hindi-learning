# Translator status report

<!-- Charted 2026-08-11 from a /grilling + /domain-modeling session. This map is an
     INDEX, not a store: each decision lives in its own ticket; the map gists it and
     links. The settled model from the charting grill is in Notes below, because
     Decisions so far may only reference RESOLVED tickets. -->

## Destination

**Redirected 2026-09-01, see "The report became a tab" in Notes.** The destination is
now the **data model**, surfaced live in the app: a `translators` roster, `translator`
as a third Share role, a tenant-configurable translator revenue share, and the
**derived status ladder** that says who the translator is per language and which rung
they are on. The reader is the course owner, on the Dashboard peer of
`/courses/[slug]/manage`, and the tickets that build that surface live on the
`ui-overhaul` map, not this one.

The original destination, kept because four ruled-out tickets still argue against it:
a Sunday-morning claude.ai Routine publishing a Claude Artifact for YWAM Potch's
**Growing in the Holy Spirit** (`prophetic-school`), showing the same ladder alongside
a breakdown of the tenant's income.

## Notes

- **Moved out 2026-09-01** in the `.plan` consolidation, which took 33 map directories
  down to 7 active maps. The seven open tickets left, all to the new
  [translation-and-locales map](../translation-and-locales/map.md), which groups Editions,
  translators and the app's own chrome: 01 stays **01** there, 02 stays **02**, 03 stays
  **03**, 08 becomes **04**, 09 becomes **05**, 10 becomes **06**, and 11 becomes **07**.
  What is left here is the four tickets closed out of scope, so this map is closed. The
  weekly report itself is **not** part of the new map's Destination; only the roster, the
  third Share role, the revenue split and the "does Finished lie" question moved.

  Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
  donor maps. **Do not reuse the old numbers here**, they remain those tickets' identity in
  this map's history, and do not mint a replacement for a moved ticket.

### The report became a tab (2026-09-01)

The operator decided that everything this map was going to publish weekly, the owner
reads live in the app instead, calling the in-app version "much more elegant". That
retires the delivery half of this map and keeps the model half.

**Ruled out, the delivery mechanism:** [04](tickets/04-report-data-query-and-script.md)
(the `PUBLISH_SECRET` query and its script), [05](tickets/05-what-the-weekly-page-looks-like.md)
(the weekly page design), [06](tickets/06-render-and-publish-the-artifact.md) (render
and publish), [07](tickets/07-stand-up-the-routine.md) (stand up the Routine).

**Kept, the model, and the reason each survives:**

- [01](tickets/01-translators-table-and-roster-import.md) roster and
  [02](tickets/02-translator-as-a-third-share-role.md) the third Share role: the tab
  needs to name humans who have no account yet, which `shares` alone cannot do.
  Verified 2026-09-01: `shares.role` is still `viewer | editor` (`convex/schema.ts:359`).
- [03](tickets/03-editions-panel-translator-selector.md) the selector: still the only
  way anyone gets appointed. Its surface moved though, see the fog below.
- [08](tickets/08-does-finished-lie.md) does "Finished" lie: **promoted in
  importance.** A wrong rung in a Sunday report is embarrassing; a wrong rung on a
  live tab the owner acts on is worse, and the tab is now its first real consumer.
- [09](tickets/09-the-translator-revenue-share.md) and
  [11](tickets/11-build-the-translator-revenue-share.md) the revenue share: a money
  model, not a surface. Nothing about where it is displayed touches whether a
  translator earns a percentage.
- [10](tickets/10-settle-the-northern-ndebele-code.md) the Ndebele code: a
  data-correctness question about a real human, independent of any surface.

**Where the surface went:** [`ui-overhaul/23`](../ui-overhaul/tickets/23-manage-dashboard-tab.md)
(the tab, plus users per language and progress buckets),
[`ui-overhaul/25`](../ui-overhaul/tickets/25-dashboard-payout-panel.md) (payout), and
[`ui-overhaul/26`](../ui-overhaul/tickets/26-dashboard-editor-progress-table.md) (the
editor-by-language table, which is what 05 was designing). Those three cite this map's
settled model rather than re-deciding it.

**This map carries build tickets, deliberately.** wayfinder's default is
plan-don't-do; the charting grill of 2026-08-11 already settled twenty-one decisions
(below), so most of what remains is construction. The two genuinely foggy decisions
are still grilling tickets (09, 08).

### The model, settled 2026-08-11

Read this before opening any ticket. Nothing here is re-litigated by a ticket; a
ticket that needs to contradict it should say so loudly in its Answer.

- **A Translator is a human**, not a translation model. Nothing in the schema records
  which model produced an Edition (`translationJobs.engine` is only `free | gemini`,
  optional, absent reading as `gemini`), so model attribution was never available and
  is not what this report is about.
- **`translators` is a real entity**, keyed **(tenant, language)** and unique, because
  it becomes a **payee**. It holds identity only: roster label, display name, optional
  email, notes, nullable language code. A translator serves the tenant's people, not
  one course.
- **`shares.role` gains a third value, `translator`**, beside `viewer` and `editor`.
  That is the **grant**; the roster row is the **identity and the payee**.
- **One selector, two writes.** Appointing someone on the Editions panel upserts the
  tenant roster row and issues the `role: "translator"` Share on that Edition.
- **Status is fully derived, never typed**: **Rostered** (roster row, never invited) →
  **Invited** (`pendingShares` with `role: "translator"`) → **Busy** (a real `shares`
  row, so they have an account) → **Finished** (`publishedEditions.published`, or a
  `listings` row exists). Staleness comes free from `_creationTime`; there is no edit
  stamp and no edit log, by decision.
  - **Finished is QUALIFIED, ruled 2026-09-01**
    ([translation-and-locales 04](../translation-and-locales/tickets/04-does-finished-lie.md),
    this map's ticket 08 before the consolidation): published-or-priced are both
    owner acts, so a live Edition on which no editor holds a completion mark renders
    **Unreviewed** rather than finished. Shipped in `c748d08`.
  - **The ladder itself did not survive its first consumer.** That surface
    ([ui-overhaul 26](../ui-overhaul/tickets/26-dashboard-editor-progress-table.md),
    2026-09-01) shows completion COUNTS per editor plus the Unreviewed qualifier, and
    no rung at all. The ladder above remains the settled model for anything that still
    wants one; nothing built uses it today.
- **The roster's five chasing columns are dropped** (`Status`, `Progress %`,
  `Date Sent`, `Date Returned`, `Last Contact`). Four are derived better; `Notes`
  survives, because off-system chasing has nowhere else to live.
- **Income is `sellerShare`**, stacked **owed** and **paid**, with `gross` in a totals
  row and the platform's 50% implied rather than called out. **Donations are
  included** as an income source. A projected translator share is marked *projected*,
  never owed.
- **The owner selects the translator; the tenant sets its own rate.** This goes
  *against* the `donationPayee` precedent (sys-admin-only, explicitly to prevent
  self-dealing) and was chosen with that named. Ticket 09 writes the ADR.
- **Shape**: a full agent Routine, third sibling of `teacher-next-lesson` and
  `translate`. One run, **YWAM Potch hardcoded**, no claim and no lock. Output is a
  **Claude Artifact**, print-friendly, no PDF. Triggered by the **claude.ai schedule**
  (Sunday 07:00 GMT+2), nothing in the app. Data via a **`PUBLISH_SECRET`-guarded
  query** behind a `pnpm` script.

### Language codes

The roster keys on a BCP-47 code from `convex/languages.ts`, gated by `isKnownLang`,
with the human's original label kept alongside. Fourteen roster languages map cleanly
except three, settled as: **Sotho → `st-ZA`** (South African orthography, already live
on prod), **Hindi → `hi`** (a human writes native script; romanization is a machine
convenience), and **Northern Ndebele → unresolved** (the label says `nd`/Matabele
which is Zimbabwe, the geography says `nr`/isiNdebele which is South African; only
Bishop Ndumisa can settle it, ticket 10).

### Reuse, do not rebuild

- **The sales rollup already exists.** [`convex/sales.ts`](../../../convex/sales.ts)
  has `report({from,to})` (per course, per edition language, gross + count) and
  `byDay` (the same window bucketed per UTC day and split by language, a ready-made
  chart series). Both are `isCallerAdmin`-gated, return **gross only**, are **not
  tenant-scoped**, and **structurally exclude donations** via `salesOnly`, whose
  comment warns that *"a third money kind must flip this to an allow-list"*. Our three
  choices (sellerShare, owed/paid, donations in) are exactly what it does not do, so
  ticket 04 is a **sibling** query reusing the rollup shape, not a caller of these.
- **Chart primitives exist**: `src/app/_components/salesChart.ts` (`VIZ_SLOTS`,
  `rankLanguages`, `colorVar`), `src/app/_components/dayChart.ts` (`niceMax`,
  `axisTicks`, `labelIndices`), and a reusable `DayStackChart` in `AdminPanel.tsx`.
  The artifact should carry the same visual language, but it is a standalone page, so
  expect to lift the maths and re-emit the SVG rather than reuse the React component.
- **The cloud env is already provisioned**: `PUBLISH_SECRET` and `CONVEX_PROD_URL` are
  set on the Routine's environment, network access Full, setup script running
  `corepack enable` / `pnpm install`. No new wiring is needed for the data read.
- **Never use the Convex CLI against prod.** A dev `CONVEX_DEPLOY_KEY` in `.env.local`
  beats `--prod` and answers for dev while looking identical. Use
  `ConvexHttpClient(convexUrl(true))`, as every script in `scripts/` does.

### The roster's source, and why it stays out of the repo

The fourteen rows live in a spreadsheet in the user's Obsidian vault at
`Work/10-YWAM-Potch/YWAM Potch Prophetic School - Translations.xlsx` (last touched
2026-07-27). **This repo is public** (`github.com/EPOHnomeL/hindi-learning`,
visibility PUBLIC), so real names, email addresses, income figures and the platform
split must never be committed. The roster is *imported* into Convex, never mirrored
into the tree, and the generated artifact is not committed either.

- Skills: `/grilling`, `/domain-modeling`, `convex:convex-expert`, `/tdd`, `/ponytail`,
  `dataviz` (before writing any chart), `artifact-design` (before publishing the page),
  `mattpocock-skills:writing-for-agents` (ticket 07's final pass).

## Decisions so far

<!-- empty: nothing resolved yet. The settled model from the charting grill is in
     Notes above, because this section may only reference RESOLVED tickets. -->

## Not yet specified

- **Week-over-week movement.** Delivery persistence was cut (no storage, no email, no
  saved URL), so each run publishes a fresh artifact with no memory of last week. A
  weekly report whose whole point is *what moved* may eventually need a stored
  snapshot to diff against. Not sharp until a few real Sundays have run.
- **A translator-facing surface.** Whether a translator ever sees their own page: their
  languages, their rung, and once the share exists, their projected earnings. Adjacent
  to the revenue share but a different audience and a different access question.
  clears-with: 09
- **Which surface the translator selector lives on.** Ticket 03 was written against
  `Editions.tsx`, which `ui-overhaul/19` deleted; 03 now points at the Sharing tab, but
  `ui-overhaul/17` also moved the access roster onto a course-scoped Users tab. Whether
  appointing a translator is a Sharing-tab act on a language row or a Users-tab act
  with language as an attribute is a real fork nobody has walked. clears-with: 03
- **Whether `notes` survives contact with real chasing.** The three date columns were
  dropped on the argument that `_creationTime` derives staleness. If the answer to
  "why has Elias not signed up" turns out to need a phone log, the dates come back in
  some form.
- **The second tenant, and the second course.** The run is hardcoded to YWAM Potch with
  no claim and no lock, which is honest today. When a second tenant needs this, whether
  the run graduates to the claim-and-lock spine the other two Routines use, or simply
  loops, is a real decision. Genuinely distant, so it floats.

## Out of scope

- **The whole weekly delivery route** (2026-09-01): the Claude Artifact, the Sunday
  07:00 GMT+2 claude.ai Routine, the `PUBLISH_SECRET`-guarded query, the `pnpm` script
  and the JSON contract with an agent. Tickets 04 to 07, each ruled out in its own
  file. The owner reads this in the app instead, on the Dashboard peer of
  `/courses/[slug]/manage`. Note this **subsumes** the two entries below about the PDF
  and the delivery machinery, and moots the one about a deterministic cron: there is
  no run of any kind to schedule now.
- **A literal PDF.** Replaced by a print-friendly Claude Artifact; anyone needing a PDF
  prints the page. Python and PyMuPDF are on the cloud image if this ever reverses.
- **Delivery machinery**: Convex file storage for the artifact, a `reports` row, Resend
  email, a recipient list, and a persisted artifact URL. All cut, because the user
  distributes the link manually.
- **An edit audit trail** (`editedAt` / `editedBy` on `translations`, or an edit-log
  table). Rejected outright, which is why "Busy" means *has an account*, not *is
  editing*.
- **A deterministic cron instead of an agent Routine.** Argued for and declined; the
  report is an agent Routine, with the consequence that an LLM arranges figures a query
  derived. Ticket 04 exists to keep the deriving out of the agent's hands.
- **A per-tenant claim queue** and multi-tenant fan-out. See the fog above.
- **The general share/invite UI as the appointment surface.** The selector lives on the
  Editions panel, per language row, not in the generic share dialog.
- **Model attribution per Edition** ("which engine translated Afrikaans"). Not
  recorded, not recoverable, and not what the report is for.
