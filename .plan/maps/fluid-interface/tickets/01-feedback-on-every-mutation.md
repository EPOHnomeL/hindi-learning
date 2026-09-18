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
