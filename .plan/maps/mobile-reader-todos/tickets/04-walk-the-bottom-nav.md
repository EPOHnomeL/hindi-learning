---
type: task
blocked_by: []
---

# Walk the mobile bottom nav at phone width

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/04-walk-the-bottom-nav.md`

## Question

Everything the bottom-nav verdict shipped on 2026-08-23 (record:
`.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`) was verified by
typecheck, the test suite and code reading, plus a single 200 from the running
dev server on `/settings`. **Nothing has been walked in a browser.** Tickets 01
and 02 each carry an unticked walk item for the same reason. This ticket is
that walk, in one pass, so the next session does not have to reconstruct the
checklist from three files.

## Done when

Every item below has been seen at phone width (device toolbar or a real
phone), the walk items in tickets 01 and 02 are ticked, and the `## Answer`
records what was actually seen, naming anything that looked wrong rather than
rounding it to "fine".

## Todo

- [ ] The tab bar renders on Home, in a lesson, on `/settings` and on `/admin`
      (admin account), and never at desktop width.
- [ ] The Course tab and the Home resume card land on the lesson most recently
      opened, including after reading on another browser profile (the
      server-side `myLastRead`, not the old per-device memory).
- [ ] `/settings`: display name saves and survives a reload; app language and
      theme apply; sign out works; browser back returns to the previous page.
- [ ] The end-of-lesson card advances and marks complete in the authed reader
      (owner and shared Viewer) and ticks the done set in the Guest reader.
- [ ] The FAB: absent mid-course, present on an active course's Frontier as
      "Mark complete", present on a completed course's last lesson as "Finish
      course", and clear of the tab bar in both cases.
- [ ] The owner card kebab: certificate claim/view, Course settings, Editions &
      sharing, and (admin) the generation controls, with the attention dot.
- [ ] Home offers the certificate on a completed course for all three card
      kinds: owned, shared, purchased (ticket 01's outstanding item).
- [ ] Nothing sits under the bar: the spacer keeps the last row of every page
      reachable, including the reader's inline Q&A and the site footer.
- [ ] The reader drawer (added 2026-08-24, ticket 06): the reading-language
      select is the first thing above *Lessons* on a multi-Edition course and
      absent on a single-Edition one; picking a language re-renders the list in
      it; the tail of the list (*Resources*) clears the tab bar; the grab handle
      drags the sheet down and a short pull snaps it back; no logo, no Sign out,
      no Light/Dark on the phone drawer.

## Notes

- `pnpm dev` is the user's process; never start or stop a server for this
  (CLAUDE.md, Never stop the dev server).
- When resolving, say which claims were walked versus read, per the repo's
  evidence-over-inference rule.
