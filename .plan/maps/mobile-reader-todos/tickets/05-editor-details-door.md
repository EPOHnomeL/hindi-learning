---
type: task
blocked_by: []
---

# Give a translated Edition's Editor back a Details door

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/05-editor-details-door.md`

## Question

The bottom-nav verdict trimmed the reader drawer to lessons, references and
resources, moving Course settings to the owner card's kebab on Home. That was
correct for the owner, who has the card, but it silently cost the **Editor of a
translated Edition** their only door to Details (edition-title-edit 02): an
Editor owns no Home card, so since 2026-08-23 they cannot fix a translated
edition's title or mission anywhere. Their only remaining edit surface is the
in-place prose editor. The regression was accepted knowingly and recorded in
the verdict (`.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`, known
costs); this ticket is the fix.

The old gate, for reference (deleted from `CourseShell.tsx` in the trim):
`header.status !== "seeded" && (canWrite || (header.lang !== "en" && header.canEdit))`
rendered `CourseSettingsButton`, and the dialog gave a non-owner Editor
Details only.

Recommended shape, to keep this a task rather than a design question: mount a
Details-only entry for exactly the Editor case (`!canWrite && header.lang !==
"en" && header.canEdit`), reusing `CourseSettingsDialog` as before. The drawer
bottom (beside the theme toggle) is the cheapest placement and only ever
renders for Editors, so the owner's drawer stays clean.

## Done when

An Editor of a translated Edition can edit that Edition's title and mission
from somewhere reachable on phone and desktop, the owner's and Viewer's
drawers are unchanged, and the `## Answer` records where the door went and why.

## Todo

- [ ] Restore an Editor-only Details door (recommended: the drawer bottom,
      gated as above, reusing `CourseSettingsDialog`).
- [ ] Confirm the owner and a plain Viewer see nothing new.
- [ ] Walk it as an Editor at phone width: open, edit the title, reload.
- [ ] Update the known-costs bullet in the verdict asset to point here as fixed.

## Notes

- If this grows a real placement debate, it stops being a chore and belongs on
  [ui-overhaul](../../ui-overhaul/map.md), per this map's rules.
