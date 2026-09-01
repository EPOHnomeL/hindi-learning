---
type: task
blocked_by: []
---

# Walk the shipped editing affordances in a browser

## Question

The whole [editing-obviousness](../assets/editing-obviousness-spec.md) spec shipped on
2026-08-31 and **nobody has looked at any of it**. No dev server was listening on the
day, tickets were never cut, and the map recorded the outstanding walk in its Notes,
where no derivation could see it. This ticket exists so it is on a frontier instead.

Five things landed that day, all un-walked:

1. The **Edit button no longer hides behind a desktop hover**. That was the original
   driver's actual blockage: the course author who asked for this was an Editor on
   their own course and never found the hover-revealed pencil.
2. The button is **accent-styled with a real pencil icon**.
3. **Resources are open by default** in both readers.
4. **Lesson rename in the editor view** (spec D10). D10 superseded D5's title-side
   pencil on 2026-08-31, and D5 had already superseded a Rename button in the lesson
   bar. **Neither the pencil nor the bar button was ever built**, so do not go looking
   for them and do not report their absence as a defect.
5. **Reference editing on a translated Edition** (spec D9, which superseded D8).

The driver was a real person with a real complaint, so the standard is theirs, not a
checklist's: an Editor opening their course cannot miss that they can edit it.

## Done when

- [ ] Every one of the five items above has been seen at desktop width and at phone
      width, in a browser, on a course where the walker holds the **Editor** role and
      not the owner role, since Editor is the role the driver had.
- [ ] A lesson rename performed in the editor view is visible in the reader afterwards,
      including the head `<title>` splice.
- [ ] Reference editing works on a **translated** Edition, not just the English one.
- [ ] The `## Answer` records what was actually seen, naming anything that looked
      wrong rather than rounding it to "fine". If something is broken, it becomes its
      own ticket here; this ticket resolves on the walk, not on the fixes.
- [ ] The remaining half of the `editing-obviousness` Destination is a judgement only
      the course author who asked can make. Say plainly in the Answer whether they
      have used it, and do not claim the Destination on their behalf.

**Never stop the dev server** (CLAUDE.md): the user runs `pnpm dev` themselves. If
nothing is listening on port 3000, say so and leave this ticket open rather than
starting one.

<!-- Cut 2026-09-01 during the .plan consolidation. Not a migrated ticket: this was the
     unmet half of the editing-obviousness map's Destination, recorded only as prose in
     that map's Notes, which is exactly how architecture-deepening lost five items of
     debt for a month. -->
