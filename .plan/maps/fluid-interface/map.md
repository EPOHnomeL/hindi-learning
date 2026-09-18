# Fluid interface

<!-- Charted 2026-09-18 from an /apple-design audit of the whole app (the audit
     itself is summarised in ## Notes; its findings are the tickets). This map is
     an INDEX, not a store: each decision lives in its ticket and is gisted here. -->

## Destination

The app responds and moves the way a well-made native app does: every control
answers on press, every mutation reports success or refusal, every sheet and
dialog arrives and leaves along one path and can be grabbed mid-flight, the
chrome is a translucent layer the content scrolls under, type is tracked and
leaded for its size and script, and all of it degrades to a cross-fade under
reduced motion. No redesign: the paper palette, Spectral, the native dialog and
the existing layouts stay.

## Notes

- **This map carries build tickets, and it was worked in one session.** The repo
  owner asked on 2026-09-18 for the map to be charted and its tasks finished the
  same session by parallel subagents. Wayfinder's default is plan-don't-do and
  one ticket per session; both are overridden here by that instruction. Every
  ticket is therefore `type: task`, AFK, resolved by a subagent with the answer
  recording what was built and how it was verified.
- **Nothing on this map was seen by a human before it was built.** No dev server
  was listening during the session, so verification is typecheck, tests and code
  reading. Each answer says so. The choices below are the skill's defaults, not
  the owner's taste; any of them is cheap to reverse and the owner should walk
  the app once before trusting them.
- **Standing choices, made here so the tickets agree:**
  - Springs without a dependency. A small critically damped spring on
    `requestAnimationFrame` (`src/app/_components/spring.ts`), damping 1.0,
    response about 0.3s for sheets. Bounce (damping 0.8) only when a release
    carried real velocity. Motion or Framer Motion were considered and ruled out
    for one drawer and a handful of dialogs.
  - Animate only `transform` and `opacity`. The `transition-[top]`,
    `transition-[bottom]` and `transition-[width]` classes go.
  - The native `<dialog>` stays; it enters and exits with CSS transitions plus
    `@starting-style`, and `transition-behavior: allow-discrete` for the exit.
  - Materials: floating chrome is `bg-paper/80` plus `backdrop-blur` and
    `saturate`, a bright top hairline instead of a `border-line` rule, a
    gradient scroll-edge fade where content meets it. Under
    `prefers-reduced-transparency` it is solid; under `prefers-contrast: more`
    it gets a defined border.
  - Type: one tracking scale by size (display -0.02em, headings -0.01em, body
    0, uppercase labels positive), chrome type in rem, and a leading bump for
    Devanagari and Naskh. No new typeface (see Out of scope).
  - Feedback goes through `mutationRun.ts` where it exists; a refusal is shown
    beside the control that caused it, in the message the server sent.
- **Audit summary (2026-09-18), so nobody re-runs it:** 14 `active:` rules
  against 266 `hover:`; the reader drawer is the only drag gesture and hands
  off to a fixed 300ms CSS ease with no velocity; the Guest reader's drawer
  handle is decorative; `Modal`, `Sheet`, `Menu`, both toasts and `InstallSheet`
  have no exit and mostly no enter; every keyframe honours reduced motion, no
  Tailwind transition does; nine consequential mutations swallow refusals;
  chrome is opaque with 1px rules stacked two deep on mobile; `font-sans`
  resolves to Spectral; `tracking-tight` is the same value at 16px and 60px.
- Skills: `/apple-design` for the values, `/ponytail` for the size of the fix,
  `/tdd` where a pure helper is added.

## Decisions so far

<!-- one line per resolved ticket -->

- [Every mutation reports its refusal](tickets/01-feedback-on-every-mutation.md):
  six confirms stay open and show the server's message, the rename dialog and
  settings page recover and confirm, upload and Q&A keep the learner's work.
  Course creation still cannot show a real refusal until `seedTopic` throws
  tagged errors, a `convex/` change left for its owner.
- [Controls answer on press](tickets/02-press-feedback.md): one base rule
  scales every button and menu item on pointer-down with a 100ms release, plus
  explicit fills on the shared primitives, tabs and nav rows. `.no-press` opts
  out.
- [The drawer moves on a spring](tickets/03-the-drawer-on-a-spring.md): a
  dependency-free critically damped spring and one shared hook for both
  readers; velocity decides above 300 px/s, position below, rubber-band above
  rest, the scrim follows the sheet. Constants unwalked; see the ticket's edge
  note.
- [Dialogs, sheets, menus and toasts arrive and leave along one path](tickets/04-enter-and-exit.md):
  the native dialog materialises via `@starting-style` and `allow-discrete`,
  the sheet rises, the menu scales from its trigger and reverses, toasts and
  the install sheet share a `useExit` hook. Reduced motion gets a 150ms fade.
- [Chrome becomes a translucent layer](tickets/06-translucent-chrome.md): one
  `.chrome` material (80% tint, 16px blur, a bright hairline facing content)
  on every floating bar, a scroll-edge fade under the sticky titles, bars that
  move by transform, shadows graded by surface size. Solid under reduced
  transparency, inked under more contrast.
- [Type is tracked and leaded for its size and script](tickets/07-type-for-its-size-and-script.md):
  a display/heading/label tracking and leading scale in `@theme`, chrome type
  in rem, a 1.7 leading for Devanagari and Naskh, `font-sans` still Spectral
  by stated choice.
- [A phone always shows where you are and how to get out](tickets/08-wayfinding-on-a-phone.md):
  a back arrow in the authed reader's phone header, a disabled Course tab when
  there is nothing to resume, the narration refusal in the dock, the generation
  failure reason as text.

## Not yet specified

- **Does the drawer become a shared sheet?** Once the reader drawer moves on a
  spring, the `Sheet` in `manage/shared.tsx` and `InstallSheet` are the same
  gesture with a different body. Whether one component carries all three is a
  question for after the drawer is seen moving. clears-with: 03
- **Is the tab bar hide-on-scroll worth keeping?** It costs the learner their
  sense of place on a phone. With the bar translucent and cheaper to look at,
  the reason to hide it weakens. The material landed in ticket 06 and the
  back arrow in 08; whether the bar should still hide needs a phone in hand.

## Out of scope

- A sans-serif for the chrome. The paper aesthetic sets the app in the same
  serif as the lessons on purpose (`globals.css` head comment), and a second
  face is a brand decision for the owner, not a fluidity fix.
- Moving the manage route's tab and edition state into the URL, and un-nesting
  it from `CourseShell`. Real wayfinding debt, but structural rather than
  behavioural; it belongs to `ui-overhaul`.
- A scrubber on the narration dock. Ruled out deliberately in
  [course-narration](../course-narration/map.md) ticket 01.
- Unifying the three toast idioms into one system. Each gets an enter and exit
  here; one component is a later cleanup.
