---
type: task
blocked_by: []
---
# The `ponytail:` markers have no ledger

## Question

There are **19 `ponytail:` comments** across `convex/` and `src/` as of 2026-09-01. Each one is
a deliberate shortcut with a written reason, which is the pattern working as intended. Nothing
tracks them, which is the pattern rotting: "later" with no ledger means never.

Where they are: `convex/eft.ts` (4), `convex/translate.ts` (2), and one each in
`content/publish.ts`, `lib.ts`, `public.ts`, `routine.ts`, `schema.ts`, `tenants.ts`,
`AdminPanel.tsx`, `ArtifactView.tsx`, `CheckoutPage.tsx`, `CourseShell.tsx`,
`manage/UsersTab.tsx`, `manage/VoucherCard.tsx`, `markdown.ts`.

**Corrected 2026-09-03: it is 20, not 19.** `src/app/_components/manage/SharingTab.tsx:198`
(the share QR download) was added between the filing and the harvest, and it is missing from the
list above. Every other file in that breakdown is still right, at the same per-file counts.
The `routine.ts` bullet below is also stale, see the `## Answer`.

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

## Answer

The ledger is `docs/ponytail-debt.md`, committed 2026-09-03. It lives in `docs/` and not under
`.plan/maps/` because it is a durable record of the codebase rather than a ticket: chartr derives
status from files under `.plan/maps/`, and a ledger has no `## Answer` to ever write, so it would
sit in that derivation as a permanently open ticket. `docs/` is where CLAUDE.md puts durable
context. It is a snapshot to be rewritten by re-running the skill, not appended to.

**The count is 20, not 19.** Harvested 2026-09-03 with the `ponytail-debt` skill
(`grep -rnE '(#|//) ?ponytail:'` over `convex/` and `src/`). The nineteenth-plus marker is
`src/app/_components/manage/SharingTab.tsx:198`, the share QR download, added after the ticket was
filed on 2026-09-01. Every other file and per-file count in the Question is still accurate; the
Question is corrected in place above. Six of the 20 name a ceiling but **no** trigger, which is
the rot risk the skill asks for: `eft.ts:27`, `public.ts:73`, `AdminPanel.tsx:1026`,
`CourseShell.tsx:185`, `SharingTab.tsx:198`, `VoucherCard.tsx:320`.

**18 accepted, 2 flagged as needing a ticket** (`convex/routine.ts:838` and `convex/tenants.ts:16`).
No marker was fixed, and no file under `convex/` or `src/` was touched.

The three load-bearing calls, each made by reading the surrounding code:

- **`content/publish.ts:25`, `by_slug.unique()`: ACCEPTED, and it is NOT a live bug.** The
  multi-tenant work has not falsified the one-Topic-per-slug assumption. `seedTopic`
  (`content/authoring.ts:59`) is the only self-serve creation path and it enforces global slug
  uniqueness itself by appending `-2`, `-3` while `topicBySlug` finds a hit; `ensureTopic` is
  `assertAdmin`-gated and adopts an existing same-slug row rather than inserting a second;
  `topics.tenantSlug` exists but nothing mints a same-slug Topic under two tenants and there is no
  tenant-scoped slug index. It stays debt with a real watch condition (any Topic insert with a
  caller-supplied slug that skips the dedupe loop), and it would fail loudly, not silently:
  `.unique()` throws, across 38 `topicBySlug` call sites.
- **`routine.ts:838`, all Lesson HTML in one query: NEEDS A TICKET, because the marker is
  factually stale.** The comment predates the content-blob migration. `lessons` rows carry no HTML
  at all today (`schema.ts:195` has `htmlStorageId` only; the inline `html` was dropped at the
  narrow step) and `collectTopicContext` returns a signed `htmlUrl` per lesson, not a body. So it
  is not in ticket [01](01-slim-the-row-listlessons-collects.md)'s family: 01 is fat rows collected
  on every learner render, this is a whole-context read once per materialise run. What is actually
  fat here is `learningRecords.markdown`, collected in full, plus whole `questions` and `responses`
  collects. The ticket should ask: correct the comment, then decide whether that
  `learningRecords` collect is worth anything at authoring-run frequency. "No" is a fine answer
  once it is written down instead of implied by a wrong comment.
- **`eft.ts:56` and `eft.ts:473`, the money-rail duplication: both ACCEPTED, and the hoist target
  named in `473` is wrong.** `56` (validation duplicated from `sellers.ts`) is a genuinely cheap
  accept: the validator itself is already shared as `payoutDetailsValidator`, what is duplicated is
  five lines of trim-and-digits, and the alternative is editing a working money function for zero
  behaviour change. Extract on a third bank-details form, beside `payoutDetailsValidator`.
  `473` (`tenantBrand` duplicated from `shares.ts`) names `lib.ts` as its hoist target, and that
  target is being dismantled: ticket [16](16-empty-lib-ts.md) is emptying `lib.ts` down to the
  Edition and grant core (open and unclaimed as of 2026-09-03, still 855 lines) and
  [17](17-rename-lib-to-edition.md) renames what is left. Hoisting a tenant-branding read there now
  would add work to 16 and put a tenant concern in a file whose whole point is holding only Edition
  code. So: do not hoist, and when the third caller appears, the target is the tenant side,
  `convex/tenants.ts` or whichever module [18](18-split-tenants-ts.md) splits it into. That
  correction generalises: on this map `lib.ts` is a source, never a sink.

One more finding worth the next session's attention, recorded in the ledger against
`convex/tenants.ts:16`: that marker's own trigger has already fired. It says to keep the Convex
copy of `TENANT_THEME_TOKENS` in sync with `src/design/tokens.ts` "when 09 lands", and 09 has
landed. The two lists agree today but nothing guards them, since each test checks its own copy.
That is the second flagged ticket, and it is a one-test fix: a test can import across the boundary
even though the Convex runtime cannot.

Evidence: verified by reading the code and the schema, plus `git`-checked ticket state for 01, 16,
17, 18 and ui-overhaul/22. Nothing here was walked in a browser, and nothing needed to be.
