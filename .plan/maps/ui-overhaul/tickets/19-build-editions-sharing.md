---
type: task
blocked_by: [16, 17]
---
# Build the reorganised sharing surface

> `/wayfinder .plan/maps/ui-overhaul/tickets/19-build-editions-sharing.md`

## Question

Ship what tickets 15, 16 and 17 decided. Those three Answers are the contract; there
is no separate spec. This is presentation plus the moves 17 assigned. Every query and
mutation stays as it is, and a rail retired from the UI keeps its backend.

Use `/tdd` and `/ponytail`.

## Todo

- [x] Split `Editions.tsx` (2023 lines, 21 components) along the seams ticket 16
      named. This is also the Editions half of ticket 06.
- [x] Render ticket 15's three groups: Who can find it, Who you hand it to, What it
      costs.
- [x] Build the merged voucher card with the distribution mode picker, each mode
      stating its billing and its identity consequence in a line.
- [x] Collapse the four bespoke confirm dialogs in this file onto `ConfirmDialog` in
      `ui.tsx`.
- [x] Move the controls ticket 17 reassigned, and make anything sent to `/settings`
      reachable there.
- [x] Run `convex:convex-authz` over everything that moved. Owner checks stay
      server-side; a move must not widen who can call it.
- [x] All copy through the existing `Editions` and `CourseSettings` message
      namespaces. No hardcoded English.
- [x] Keep tenant theming expressible (ADR 0022).
- [x] Add the CONTEXT.md edit ticket 15 assigned: "one code each" and "one shared
      code" onto the Avoid lists of the Bulk Vouchers and Organisation Voucher
      entries.
- [x] `pnpm typecheck` green, tests covering the moved controls' authorisation.
- [x] Walk it in a browser on a real course at phone width.

## Done when

Every box above is ticked and the Answer records that it was walked in a browser at
phone width rather than only read.

## Answer

Built 2026-08-27. `EditionsDialog` is gone; the owner manages a course at
`/courses/[slug]/manage`, the shell ticket 16 decided, with the Sharing tab laid out
as ticket 15's three groups and the moves ticket 17 assigned. Every Convex query and
mutation is untouched.

### The split

`Editions.tsx` is deleted. Its 21 components landed along ticket 16's seams:

- **Shell**: [manage/page.tsx](../../../../src/app/(app)/courses/%5Bslug%5D/manage/page.tsx)
  plus [ManageShell.tsx](../../../../src/app/_components/manage/ManageShell.tsx).
  Two-row header (back, "Manage course", edition button), one underlined row of four
  peer tabs, one centered column at both widths, a transient toast, and the edition
  sheet, which replaced `EditionPicker` and now also houses `AddLanguagePanel`.
- **Sharing tab**: [SharingTab.tsx](../../../../src/app/_components/manage/SharingTab.tsx).
  Publish (group one); Public link then Invite (group two); the price row and the
  voucher card (group three); the danger menu and the translating/failed states at
  the foot. Publish and Public link confirm through the toast, per the prototype's
  accepted flows.
- **Voucher card**: [VoucherCard.tsx](../../../../src/app/_components/manage/VoucherCard.tsx).
  One card, mode picks distribution: "One shared code" (the `accessCodes` backend)
  against "One code each" (`voucherBatches`), each stating its billing and its
  identity consequence in a line, exactly ticket 15's shape. Both backends untouched;
  the mint forms and rows moved in whole.
- **Users tab**: [UsersTab.tsx](../../../../src/app/_components/manage/UsersTab.tsx).
  The roster left the per-Edition panel. Until ticket 22 builds the course-scoped
  surface, this tab relocates the existing per-Edition rosters unchanged, one section
  per language, so role toggles and revoke stay reachable. Marked `ponytail:` in the
  file; 22 replaces the interior.
- **Course settings tab**: hosts the existing dialog body, extracted as
  `CourseSettingsBody` in [CourseSettings.tsx](../../../../src/app/_components/CourseSettings.tsx).
  Teacher Q&A moved into it as a section, losing the `edition.source &&` guard and
  the whole-course disclaimer line, as ticket 17 ruled. Its message keys moved from
  `Editions` to `CourseSettings` in all five locales. Ticket 20 redesigns the
  interior.
- **Dashboard tab**: a placeholder card. Ticket 23 builds it.

The dashboard card's globe button now navigates to the route
([CourseCardActions.tsx](../../../../src/app/_components/CourseCardActions.tsx));
ticket 24 owns that card's redesign.

### Calls this ticket made, for the operator to react to

- **Phone tabs are text-only; icons join from `sm` up.** At 360px four iconed labels
  cannot fit untruncated, and the phone tab row the operator actually approved (R1)
  was text-only. The verdict's "each with an icon" holds on desktop.
- **A one-edition course shows no edition button** (per the prototype record), so
  "Add a language" gets a quiet row at the Sharing tab's foot; with several editions
  it lives in the edition sheet.
- **The turn-on-selling sheet is two steps in one sheet**: the payout form, and when
  `sellerStatus` flips to ready the same sheet becomes the price fields.

### Corrections to this ticket's own claims

- **The four confirm dialogs were already on `ConfirmDialog`** when this ticket was
  charted: `7ffb908` (2026-07-23) built the danger-menu confirms on it and `3c13e4d`
  (2026-08-25) did the same for the stop-code confirm. The only bespoke dialog is
  `RetranslateConfirm`, deliberately, because it carries the engine picker. Nothing
  to collapse; the box is ticked because the state it asks for already holds.
- **Nothing goes to `/settings`**: ticket 17 resolved that after this ticket was
  written. The seller grant and payout details stay inside the collapsed "Selling is
  off" row.

### Authorisation

`convex:convex-authz` ran over the modules behind every moved control (`capture`,
`shares`, `catalogue`, `market`, `sellers`, `vouchers`, `accessCodes`): the scan's
single identity-from-arg hit is `claimSeat`, an `internalMutation`, the stated
legitimate exception. No findings, nothing hardened, no move widened a caller. The
authorisation tests the todo asks for already exist and pass (40 tests):
`capture.test.ts` rejects a non-owner on `setTeacherQa`, `sharing-readonly.test.ts`
rejects non-owners on `listEditionAccess`, `setShareRole` and `revokeShare`. No new
tests were needed because no server behaviour changed.

### Evidence: walked in a browser at 360px, on the dev deployment

Playwright drove headless Chromium at 360x740 against a dev server on port 3100,
signed in as a fresh account (`ui19-walk@example.com`) on a course created for the
walk (`phone-walk-19`, marked completed via `pnpm complete`). Walked, with
screenshots in [assets/manage-walk/](../assets/manage-walk/): all four tabs, the
three Sharing groups, publish and public-link toggles with their toasts, invite,
the add-language sheet (locked and unlocked states), the "Selling is off" row, the
two-step turn-on sheet ending in a ZAR 100 price, publishing, both voucher modes,
minting a shared code, the code row with its copyable `/join?voucher` URL, and
stopping the code through its `ConfirmDialog`. Zero horizontal overflow at 360px and
zero console errors across every run. The walk found and fixed one real defect: the
tab row truncated its labels until the buttons got `min-w-0 flex-auto`.

Not walked: the edition sheet with many editions (the walk course has one; adding a
language runs a real translation), the batch CSV download, and desktop width, which
is the same shell given room. `pnpm typecheck` green.

The walk left residue on the **dev** deployment: user `ui19-walk@example.com`
(password disclosed in the session transcript) holds a **sys-admin allowlist row**
that the UI cannot self-remove, plus a seller grant, a completed `phone-walk-19`
course and one stopped code with zero seats (no ledger row). The operator should
remove that allowlist row from the admin panel.
