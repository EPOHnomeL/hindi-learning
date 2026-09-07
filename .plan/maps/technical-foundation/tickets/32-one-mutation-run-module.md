---
type: task
blocked_by: []
---
# One mutation-run module behind the busy/error triples

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 8), re-verified in
the tree on 2026-09-07.

Every Admin and manage control re-implements the same four-part dance by hand: a busy
flag, an error slot, a try/catch/finally, and the `ConvexError` unwrap. The review counted
42 busy flags, 27 error slots and three mutually incompatible error interfaces across the
client, with **no shared implementation anywhere**.

Two consequences, and both are behavioural rather than cosmetic:

- **The `ConvexError` unwrap has been re-learned from separate production incidents.**
  `AdminPanel.tsx:17-28` records the first; `ArtifactView.tsx:653-661` records a second,
  dated 2026-08-05; `JoinPanel.tsx:315-319` and `RedeemPanel.tsx:281` are copies three and
  four. `manage/VoucherCard.tsx:176-179` knows the rule and gives up on it.
- **Seven call sites discard the server's refusals entirely**, having a `finally` and no
  `catch`: `manage/UsersTab.tsx:72,106`, `manage/SharingTab.tsx:694,715,987`,
  `CourseSettings.tsx:152,410`. The server writes a carefully worded refusal and the user
  sees nothing.

`AdminPanel.tsx:1863-1901` and `:1905-1931` are siblings that each carry their own copy,
which is the pattern in miniature.

## Done when

One module exposes `run`, `busy` and `error`, and owns the `ConvexError` unwrap (string
data, object data, the redacted production `Error`, a local `Error`, a non-`Error` throw),
the `finally`, and the reset-on-edit. Call sites declare intent instead of writing the
twelve lines. `mutationError`, `saveError` and `messageFor` are deleted rather than left
alongside. The seven silent sites gain a visible error by construction, and that is
demonstrated rather than assumed.

`pnpm typecheck` and `pnpm test` green.

**This is a hook, not a component, so it does not wait on
[03](03-shadcn-foundation.md).** 03 settles the component vocabulary; how a control
surfaces an error message visually is 03's business, but where the message comes from is
this ticket's, and the two can land in either order. Do not let this one drift into
restyling.

**The testing gap is the point, and it is worth checking first.**
`vitest.config.ts` runs the `edge-runtime` environment and there is **not one `.test.tsx`
in the repo** (verified 2026-09-07: 28 `.test.ts`, 0 `.test.tsx`). A hook is testable
without a rendered tree, which is most of why this shape is worth having, but confirm what
the current config can actually run before promising a test in the Answer.
