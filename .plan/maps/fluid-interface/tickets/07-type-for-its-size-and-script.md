---
type: task
blocked_by: [06]
claimed_by: fable-t3code-e63c30e8
claimed_at: 2026-09-18T10:55:58+02:00
---
# Type is tracked and leaded for its size and script

> `/wayfinder .plan/maps/fluid-interface/tickets/07-type-for-its-size-and-script.md`

## Question

`tracking-tight` is the same -0.025em at 16px (`CourseShell.tsx:203`) and 60px
(`YwamPotch.tsx:170`). Headings never set leading; the only tightened display
leading is inside the certificate CSS. Navigation labels (`AppTabs.tsx:131`,
10px), every settings heading and body line (`CourseSettings.tsx`, 13px and
12.5px), the manage tab labels and the legal reading column (`(legal)/layout.tsx:23`,
15px) are fixed px. `font-deva` and `font-naskh` swap the family on `<body>`
with no leading change into fixed-height boxes (`AppTabs` `h-[4.75rem]`,
`Dashboard.tsx:410` `min-h-[38px]`). `--font-sans` resolves to Spectral.

Declare a tracking and leading scale in `@theme` (display -0.02em / 1.05,
heading -0.01em / 1.2, body 0 / 1.5, label +0.04em), apply it where the
utilities above are used, convert the fixed px type in chrome to rem, give
`.font-deva` and `.font-naskh` a leading of about 1.7 and let the fixed boxes
grow with `min-h` in rem. Leave `--font-sans` aliasing Spectral but say so in a
comment (a sans is out of scope).

## Done when

No `text-[NNpx]` remains in `AppTabs`, `CourseSettings`, `ManageShell` or the
legal layout; display, heading and body use the scale; tall scripts have their
own leading; typecheck passes.
