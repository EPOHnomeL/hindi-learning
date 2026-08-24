---
type: task
status: resolved
blocked_by: []
---

# Let a multi-Edition Viewer switch reading language again

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/06-viewer-edition-switcher.md`

## Question

The reader drawer's Edition switcher was removed with the bottom-nav verdict
(2026-08-23). The owner kept a control: the globe on their Home card. But a
**Viewer shared several Editions** kept nothing: the shared and purchased
cards' language chips are informational, so the only way such a Viewer can
change reading language now is hand-editing `?lang=` in the URL. Accepted
knowingly in the verdict (`.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`,
known costs); this ticket restores a control.

Recommended shape: give the shared and purchased cards the same globe menu the
owner card got (`CourseCardActions.tsx` has the menu to lift), shown only when
`langs.length > 1`, listing the Editions the caller holds and opening the
course `withLang`. That keeps the "reading language lives on the course card"
rule the verdict established, rather than reintroducing a switcher inside the
reader.

`header.editions` is already scoped server-side to the caller's held
languages, and the card queries (`listSharedTopics`, `myPurchases`) already
carry `langs`, so this is markup, not backend.

## Done when

A Viewer holding two or more Editions of a shared or purchased course can open
either language from Home without touching the URL, a single-Edition Viewer
sees no new control, and the `## Answer` records the control chosen.

## Answer (2026-08-24)

**The control went back into the reader drawer, not onto the viewer cards.**
`ReadingLanguage.tsx`: a globe and a native `<select>` of the Editions the
caller holds, mounted at the TOP of `CourseShell`'s nav above *Lessons*, only
when `header.editions.length > 1`. A pick navigates `withLang()` (English
included, so the Edition stays pinned) and latches `LANG_KEY`, which is exactly
the deleted drawer switcher's behaviour.

Why not this ticket's own recommendation (copy the globe onto the shared and
purchased cards): a user in Ivory Coast reported the hole on the morning of
2026-08-24, and their report showed the recommendation solves the wrong half.
Being *inside* a course in the wrong language is when you want to change it;
sending someone back to Home to a card menu is the long way round, and it would
have meant three copies of one control (owned, shared, purchased cards) instead
of one. One control in the drawer serves owner, Editor, Viewer and preview
reader alike, so the card globe now has a second door rather than three
siblings. The card globe stays as-is.

Shape chosen from a three-variant prototype (full-width row / chips / native
select). The select won on `ponytail` grounds: one tap on Android, no popover
state, and it does not wrap into a wall at twenty Editions the way chips do.

Not in scope, verified rather than assumed: the **Guest `/share` reader keeps no
switcher**. `api.public.publicCourse` serves the one Edition its token is for,
so there is no set to choose from there. The prototype claimed otherwise; the
code says one Edition per token, and the code is right.

Two neighbours fixed in the same pass, both reported in the same message:

- The drawer's tail was running under the 4.75rem app tab bar (`fixed bottom-0`
  with no allowance for it), so *Resources* and the theme toggle were
  unreachable at any scroll position. `pb-[5.75rem]` on the mobile drawer.
- The drawer's grab handle looked draggable and was decoration. It now drags:
  `drawerDrag.ts` (`dragOffset`, `shouldDismiss`, unit-tested) plus pointer
  handlers on the handle. Release past a quarter of the sheet's height, floored
  at 80px, closes it; short of that it snaps back.

Also per the same report: the drawer's brand lockup and Sign-out row are now
desktop-only, so on a phone the course title leads. Sign out lives on
`/settings`, one tab away, and Home is a tab. Light/Dark went desktop-only in
the drawer for the same reason: on mobile it is `/settings` -> Appearance.

## Todo

- [x] Lift the globe menu into a shared piece or duplicate it knowingly on the
      shared and purchased cards (`langs.length > 1` only). *Superseded: one
      control in the drawer instead, see the Answer.*
- [x] Check the per-device language memory (`LANG_KEY`) still makes reopening
      land in the last-read Edition, or record that it only ever worked via the
      deleted drawer switcher and decide whether the card pick should latch it.
      *`ReadingLanguage` latches it on every pick, as the drawer switcher did.*
- [ ] Walk it as a Viewer with two Editions at phone width. **Still open**:
      resolved by reading the code and `pnpm typecheck` plus the suite (869
      pass), NOT by a browser. Folds into
      [04-walk-the-bottom-nav](04-walk-the-bottom-nav.md).
- [x] Update the known-costs bullet in the verdict asset to point here as fixed.

## Notes

- The old drawer switcher's behaviour, for reference: explicit pick navigated
  `withLang` (English included, pinning the Edition) and latched `LANG_KEY`.
- Whether the two readers' drawers should carry any of this again is
  [ui-overhaul](../../ui-overhaul/map.md) territory, not this ticket.
