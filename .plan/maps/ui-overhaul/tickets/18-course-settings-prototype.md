---
type: prototype
blocked_by: [17]
---
# What course settings looks like once it holds what ticket 17 sent it

> `/wayfinder .plan/maps/ui-overhaul/tickets/18-course-settings-prototype.md`

## Question

`CourseSettings.tsx` has zero responsive classes and a `min-h`-free scroll holding
Details, the emblem, the lifecycle and a full list of lessons with a trash icon each.
On a phone the mission textarea and a 32-lesson delete list share one column, and the
save button scrolls away from the field it saves.

Prototype it for the control set ticket 17 assigns, at 360px. The mission field is the
real problem: it holds Markdown long enough to need its own space, and the current
four-line textarea with a drag handle is unusable on touch. Decide whether it stays
inline, gets a full-height editor, or moves out.

Two entry points must keep working. The reader opens this dialog for the Edition being
read, the dashboard opens it for the UI-locale Edition, and an Editor sees Details
alone. Whatever the prototype becomes has to serve all three.

## Done when

A prototype is committed under `assets/` and reachable in a browser, the Answer settles
the mission field and the save affordance, and both entry points plus the Editor view
are shown working at 360px with no horizontal scroll.
