---
type: task
blocked_by: [03, 04]
---
# Chrome becomes a translucent layer the content scrolls under

> `/wayfinder .plan/maps/fluid-interface/tickets/06-translucent-chrome.md`

## Question

On a phone the reader stacks two opaque sticky bars with two 1px rules
(`CourseShell.tsx:185`, `ArtifactView.tsx:702`), then an opaque narration dock
(`ArtifactView.tsx:1139`) over the tab bar, whose `bg-paper/95` makes its blur
invisible. The Guest reader repeats the header. Shadows ignore size: a 216px
popover, a hover tooltip and a full-page checkout panel sit at the same depth.

Make the floating chrome one material: `bg-paper/80 backdrop-blur saturate-150`,
a bright top hairline (`border-white/40` in light, `border-white/10` in dark)
instead of `border-line`, and a gradient scroll-edge fade under the sticky title
bar instead of its rule. Apply to the reader headers, the title bars, the
narration dock, the tab bar, the resume card and `InstallSheet`. Grade shadows:
`shadow-sm` for chips and popovers, `shadow-lg` for sheets and the dock,
`shadow-xl` only for the dialog. Replace the `transition-[top]` and
`transition-[bottom]` moves with `translate-y` transforms.

## Done when

The named surfaces share one material class, no sticky surface ends in a
`border-line` rule, shadow depth follows surface size, the bars move by
transform, typecheck passes.
