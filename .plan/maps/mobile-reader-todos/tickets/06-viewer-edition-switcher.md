---
type: task
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

## Todo

- [ ] Lift the globe menu into a shared piece or duplicate it knowingly on the
      shared and purchased cards (`langs.length > 1` only).
- [ ] Check the per-device language memory (`LANG_KEY`) still makes reopening
      land in the last-read Edition, or record that it only ever worked via the
      deleted drawer switcher and decide whether the card pick should latch it.
- [ ] Walk it as a Viewer with two Editions at phone width.
- [ ] Update the known-costs bullet in the verdict asset to point here as fixed.

## Notes

- The old drawer switcher's behaviour, for reference: explicit pick navigated
  `withLang` (English included, pinning the Edition) and latched `LANG_KEY`.
- Whether the two readers' drawers should carry any of this again is
  [ui-overhaul](../../ui-overhaul/map.md) territory, not this ticket.
