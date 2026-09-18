---
type: task
blocked_by: []
---
# Every mutation reports its refusal

> `/wayfinder .plan/maps/fluid-interface/tickets/01-feedback-on-every-mutation.md`

## Question

Nine consequential mutations swallow failure. Delete account
(`SeatSettings.tsx:204`), delete lesson (`CourseSettings.tsx:358`), mark course
complete (`CourseSettings.tsx:418`), void a voucher batch (`VoucherCard.tsx:421`),
regenerate a public link (`SharingTab.tsx:891`) and remove an edition
(`SharingTab.tsx:922`) all run `void mutation().finally(close)`, so a refused
delete closes its confirm as if it worked. The rename dialog
(`SettingsDialog.tsx:48`) has no catch and parks on "Saving…"; its mobile twin
(`SettingsPage.tsx:150`) neither confirms nor reports. Resource upload
(`CourseShell.tsx:430`) resets its button and says nothing. The Q&A box
(`ArtifactView.tsx:1542`) clears the typed question before the write resolves.
Course creation (`Dashboard.tsx:886`) guesses "one course per day" for any
refusal.

`mutationRun.ts` already holds the contract ("the catch is the point"). Route
each site through it or the equivalent, show the server's message beside the
control, keep the dialog open on refusal, and keep the learner's typed text.

## Done when

Each listed site keeps its dialog or field on refusal and renders the refusal
text beside the control; `SettingsPage` says "Saved" like the dialog does;
typecheck and the test suite pass.

## Answer

Built 2026-09-18, commit `5a1db3c` (the upload and Q&A sites rode in `15f454b`
and `b0a2533`, which share their files). Verified by typecheck, the component
test suite and code reading; not walked in a browser.

- The six confirms (delete account, delete lesson, mark complete, void batch,
  regenerate link, remove edition) run through `useMutationRun`. The confirm
  stays open on refusal and renders the server's message in `ConfirmDialog`'s
  `extra` slot; it closes only when the run resolves. Cancel resets the error
  so it does not reappear next time.
- The rename dialog catches, returns to idle and shows the message under the
  hint. The settings page does the same and reads "Saved" on success, the
  dialog's idiom. Typing clears the message in both.
- Resource upload shows the upload's own localised failure text under the
  buttons. The Q&A field clears only after the server has the question and
  shows the refusal below the form otherwise.
- Course creation calls `refusalMessage` with "one course per day" as the
  fallback. **It still shows the fallback for every refusal in production**,
  because `seedTopic` in `convex/content/authoring.ts` throws plain `Error`s
  (unauthenticated, allowlist, daily cap) that Convex redacts. Making it throw
  tagged `ConvexError`s is a `convex/` change outside this map; the code
  comment records the 2026-09-18 state.
- One new key, `Settings.updateError`, in all six locale files.

Full-suite note: `scripts/bundle-authoring-assets.test.ts` fails on this
Windows worktree before and after this work, on CRLF drift in files nobody
touched. Three independent agents traced it to the same cause.
