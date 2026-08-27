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

Three entry points must keep working: the reader opens this for the Edition being
read, the dashboard for the UI-locale Edition, and an Editor sees Details alone.

## Done when

A prototype is committed under `assets/` and reachable in a browser, the Answer settles
the mission field and the save affordance, and all three entry points are shown working
at 360px with no horizontal scroll.
