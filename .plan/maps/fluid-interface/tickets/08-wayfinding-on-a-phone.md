---
type: task
blocked_by: [06]
---
# A phone always shows where you are and how to get out

> `/wayfinder .plan/maps/fluid-interface/tickets/08-wayfinding-on-a-phone.md`

## Question

The authed reader's mobile header has no back control (`CourseShell.tsx:189`, a
hamburger in the leading slot) while the Guest reader has one
(`PublicReader.tsx:143`). With no reading history the Course tab points at Home
and both tabs light (`AppTabs.tsx:57`), with opacity as the only cue.
Narration refusals post into the iframe beside the inline play button, which may
be scrolled away, while the persistent dock shows only a clock
(`ArtifactView.tsx:843`). Generation failure reasons hide in a `title`
attribute (`ArtifactView.tsx:1368`), unreachable on touch.

Add a back-to-courses control to the authed mobile header; make the Course tab
with no history a disabled tab with its label intact rather than a dimmed link
to Home; pass the narration message into the dock and render it there; show the
generation failure reason as visible text.

## Done when

The authed reader header has a back link on mobile; the Course tab is
`aria-disabled` with no href when there is no resume point; the dock renders the
refusal message; the generation failure reason is visible text; typecheck passes.

## Answer

Built 2026-09-18, commit for ticket 08. Verified by typecheck and the `src` and
`messages` suites; not walked in a browser.

- The authed mobile header now leads with the Guest reader's back arrow (a link
  to the library, `press` class), then the hamburger, then the title. The
  header comment that had recorded the arrow's 2026-08 removal in favour of the
  Home tab was rewritten to record this reversal. The row fits 360px.
- `Tab` takes an optional href. With no resume point the Course tab renders as
  an `aria-disabled` span with icon and label intact and no pointer events, so
  it no longer navigates to Home or lights two tabs. The `muted` prop is gone.
- `NarrationDock` receives the narration message and renders it in danger text
  under the clock whenever it is non-empty and playback is not running. The
  iframe still gets the same message for the inline button. Five new
  `Artifact` keys localise the dock's strings in all six locales.
- The generation failure branch drops the `title` attribute and renders the
  reason after the label as text.

The hide-on-scroll fog patch stays open: the bar now hides only inside a
course and the material is cheaper, but whether it should hide at all needs a
phone in hand, so it is left for the owner's walk rather than decided here.
