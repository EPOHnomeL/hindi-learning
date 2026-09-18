---
type: task
blocked_by: [06]
claimed_by: fable-t3code-e63c30e8
claimed_at: 2026-09-18T10:55:58+02:00
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
