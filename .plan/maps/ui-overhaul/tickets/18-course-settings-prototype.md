---
type: prototype
blocked_by: [17]
---
# What course settings looks like once it holds what ticket 17 sent it

> `/wayfinder .plan/maps/ui-overhaul/tickets/18-course-settings-prototype.md`

## Question

`CourseSettings.tsx` has zero responsive classes and one scroll holding Details, the
emblem, the lifecycle and every lesson with a trash icon. On a phone the mission
textarea and a 32-lesson delete list share one column, and the save button scrolls
away from the field it saves.

Prototype it at 360px for the control set ticket 17 assigns. Two things to settle:

- **The mission field**, which is the real problem. It holds Markdown long enough to
  need its own space and the current four-line textarea with a drag handle is unusable
  on touch. Inline, full-height editor, or moved out?
- **The save affordance**, so it stays with what it saves.

**Correction, 2026-08-27.** This ticket was charted claiming three working entry points.
There is **one**: the owner's dashboard card kebab, the only caller of
`CourseSettingsDialog`, which never passes `owner`, so the `owner={false}` Details-only
branch is dead code. Commit `e228ba5` (2026-08-23) removed the reader's door on purpose
and its own message records the cost. The three-entry-points claim was transcribed from
the file's stale header comment four days later. Ticket 17 decided the Editor gets that
door back **in the reader**, Details only, gated on the per-Edition `canEdit` that
`courseHeader` already computes. Prototyping where in the reader it hangs, drawer or
header, is this ticket's; building it is ticket 20's.

The control set ticket 17 assigned: Details (source and translated Edition), the
certificate emblem, lesson deletion, the completion lifecycle, and **Teacher Q&A**,
arriving from the sharing panel as a course-wide toggle with no disclaimer left to carry.

17 left one call to this prototype on purpose. Lesson deletion and the completion
lifecycle both stay on this surface, but their arrangement inside it is yours. The
recommendation on offer was one collapsed Danger section at the bottom mirroring
`EditionDangerMenu`; the owner said surprise them.

## Done when

A prototype is committed under `assets/` and reachable in a browser, the Answer settles
the mission field, the save affordance, and the arrangement of lesson deletion and the
lifecycle, and the owner's dashboard entry plus the Editor's reader door are shown working
at 360px with no horizontal scroll.
