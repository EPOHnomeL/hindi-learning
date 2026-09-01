---
type: task
blocked_by: []
---
# The 19 `ponytail:` markers have no ledger

## Question

There are **19 `ponytail:` comments** across `convex/` and `src/` as of 2026-09-01. Each one is
a deliberate shortcut with a written reason, which is the pattern working as intended. Nothing
tracks them, which is the pattern rotting: "later" with no ledger means never.

Where they are: `convex/eft.ts` (4), `convex/translate.ts` (2), and one each in
`content/publish.ts`, `lib.ts`, `public.ts`, `routine.ts`, `schema.ts`, `tenants.ts`,
`AdminPanel.tsx`, `ArtifactView.tsx`, `CheckoutPage.tsx`, `CourseShell.tsx`,
`manage/UsersTab.tsx`, `manage/VoucherCard.tsx`, `markdown.ts`.

At least three are load-bearing rather than cosmetic, and they are the reason this is worth an
hour:

- `content/publish.ts`: `by_slug.unique()` **assumes one Topic per slug globally**, true only
  until it isn't. That is a correctness assumption, not a tidiness one.
- `routine.ts`: returns **all Lesson HTML in one query**, the same read-amplification family as
  [01](01-slim-the-row-listlessons-collects.md).
- `convex/eft.ts`: validation duplicated from `sellers.ts`, and share logic duplicated from
  `shares.ts` rather than hoisted into `lib.ts`. Both are duplication on the **money** rail, and
  the hoist target is the file [16](16-empty-lib-ts.md) is emptying.

The repo already has a `ponytail-debt` skill for exactly this harvest, so the work is running it
and deciding what the output is worth, not inventing a format.

## Done when

The ledger exists as a committed file, each marker is either accepted with a reason or has a
ticket, and the three flagged above have an explicit call. This ticket does **not** fix any of
them; it makes them visible.
