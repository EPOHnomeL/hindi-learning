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

## Answer

Built 2026-09-18, commit `25072c3`. Verified by typecheck and the `src` test
suite; **not walked in a browser**. The blur, the hairline direction and the
scroll-edge fade are the kind of thing only eyes can judge, so the owner should
open the reader on a phone before trusting this.

- One `.chrome` material in `globals.css`: an 80% paper tint (`.chrome--card`
  for card surfaces) under `blur(16px) saturate(150%)`, with a bright inset
  hairline on the edge facing content (`.chrome--top` flips it for headers).
  The hairline is composed with `--tw-shadow` so Tailwind's `shadow-lg` still
  renders on the same element. Without `backdrop-filter` support it falls back
  to a 95% solid. Reduced transparency makes it solid with no blur; more
  contrast recolours the hairline to ink. `.chrome--mobile` turns it off at
  `md`, where the title bars are static headings.
- Applied to both reader headers, the four sticky title bars (which also gain a
  12px `.chrome-fade` gradient below instead of a rule), the narration dock,
  the tab bar, the resume card, the install sheet and the completion bar. The
  drawer asides stay opaque paper on purpose: they hold a scrolling list.
- The title bars and the dock move by `translate-y` with `transition-transform`
  instead of animating `top` and `bottom`. No `transition-[top]` or
  `transition-[bottom]` remains in `src`; the `transition-[width]` fills are
  ticket 05's.
- Shadows: `Menu` and the sharing popover `shadow-xl` to `shadow-md`, the chart
  tooltip to `shadow-sm`, the completion bar to `shadow-lg`, the dock gains
  `shadow-lg`; only `Modal` keeps `shadow-xl`.

This resolves the fog patch about hide-on-scroll only partly: the bar is now
cheaper to look at, but whether it should still hide inside a course is a
question for the owner's walk, so it stays in Not yet specified re-anchored to
ticket 08.
