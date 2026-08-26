---
type: task
blocked_by: [02, 03]
---
# Walk the prophetic school with Teacher Q&A off

## Question

The feature is entirely about what a person sees, so the closing claim has to be that a person saw
it. "Verified by reading the code" and "walked in a browser" are different claims, and recording the
first as though it were the second is how a built-but-never-seen feature gets marked done.

Walk the motivating course, `prophetic-school` on the YWAM Potchefstroom tenant, in both states.
It is the acceptance case named in [spec.md](../spec.md): nine lessons, each carrying a green ask
block of the same two part shape (the invitation, then a "Main source for this week's reading"
citation) and a `<footer>` carrying the fuller attribution.

With the setting **off**, a learner should see no Q&A panel, no unread reply dots, no green block,
and an intact footer citation. With it **on**, the course should look exactly as it does today.

Check the states that are easy to skip and expensive to get wrong: both widths, both themes, and at
least one Edition that is not the source language, since the setting is per Topic and must apply to
every Edition without being set on any of their tabs.

The dev server is the user's. Curl or use a port that is already listening. Do not start one, and
never kill whatever is on port 3000.

## Done when

- The course is walked with the setting off: no desktop Q&A column, no mobile inline block, no
  sidebar reply dots, no green ask block, footer citations present.
- The same course is walked with the setting on and looks exactly as it did before the effort began.
- Walked at a desktop width and a mobile width.
- Walked in both light and dark themes.
- Walked on at least one non source language Edition, confirming the per Topic setting reaches an
  Edition whose own tab carries no toggle.
- Checked as a Guest through a public link, confirming the owner's Q&A is absent from the payload
  and not merely from the page.
- Any defect found is either fixed here or filed as a new ticket in this map, and the resolution
  says which.
- The resolution states plainly that this was walked in a browser, and names what was actually
  looked at.

## Answer

**Walked in a browser by the repo owner on 2026-08-26**, on `prophetic-school` on the YWAM
Potchefstroom tenant, and it behaves as specified. This is the browser claim tickets 01, 02 and 03
each deferred to here, and it is the owner's own report rather than an agent reading code: no agent
saw these pixels.

Covered, per the owner: the course with Teacher Q&A **off** and again with it **on**, at a desktop
width and a mobile width, in light and dark, on a non source language Edition (confirming the per
Topic setting reaches an Edition whose own tab carries no toggle), and as a Guest through the public
link. No defects were found, so nothing was fixed here and no follow up ticket was filed.

One note for whoever reads this later: the "no sidebar reply dots" line in the Done-when could not
fail, because the dot has been unwired since 2026-07-09 (`1d05eb7`) and renders on no course in any
state. Ticket 03's Answer and a dated correction in [spec.md](../spec.md) carry the detail.

That closes the map: the destination named at the top of [map.md](../map.md) is reached.
