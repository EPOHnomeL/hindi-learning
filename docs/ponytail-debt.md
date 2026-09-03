# The `ponytail:` debt ledger

Every deliberate shortcut in this repo is marked with a `ponytail:` comment naming what was
simplified and, ideally, the trigger that should make someone revisit it. This file is the
harvest of those markers, so a deferral cannot quietly become permanent.

Harvested **2026-09-03** by the `ponytail-debt` skill over `convex/` and `src/`
(`grep -rnE '(#|//) ?ponytail:'`). **20 markers, 6 with no trigger.**

It lives in `docs/` because it is a durable record of the codebase, not a ticket: `.plan/maps/`
is for tickets and chartr derives status from those files, and a ledger with no `## Answer` would
sit in that derivation forever as an open ticket that is never meant to close.

Each row carries the file, the line, the reason written in the comment, and an explicit call:

- **ACCEPTED**: fine to leave, with the reason it is fine.
- **NEEDS A TICKET**: what the ticket would ask, in one line.
- `no-trigger`: the comment names a ceiling but no condition that would make anyone revisit it.
  These are the ones that rot silently.

Line numbers are as of 2026-09-03 and will drift. The marker text is the durable anchor.

## Rewrite this file, do not append to it

The ledger is a snapshot, not a log. Re-run the `ponytail-debt` skill and replace the rows;
the git history is the record of what changed.

## convex

### `convex/content/publish.ts:25` (load-bearing)

`ensureTopic` resolves a Topic with `by_slug` + `.unique()`, which assumes one Topic per slug
globally. ceiling: one Topic per slug across all owners and all tenants. upgrade: issue 05
owner-scoping the routine and publish path.

**ACCEPTED.** Verified by reading the code on 2026-09-03: the assumption is still true, and the
multi-tenant work has **not** made it false, so this is debt and not a live bug.

- `seedTopic` (`convex/content/authoring.ts:59`) is the only self-serve creation path and it
  actively maintains global uniqueness: `for (let n = 2; await topicBySlug(ctx, slug); n++)`.
  Two owners asking for the same title get `foo` and `foo-2`.
- `ensureTopic` itself is `assertAdmin`-gated and adopts an existing same-slug row (backfilling
  `ownerId`) rather than inserting a second one.
- `topics.tenantSlug` exists and `by_tenant` lists a subdomain's courses, but no path mints a
  same-slug Topic under two tenants, and there is no tenant-scoped slug index
  (`by_slug`, `by_owner`, `by_owner_slug`, `by_public_token`, `by_tenant`).

The blast radius if that ever changes is wide, not narrow: `topicBySlug` has 38 call sites and
`.unique()` throws on a second row, so the failure would be loud rather than silent. Watch
condition: the first code that inserts a Topic with a caller-supplied slug without the
`topicBySlug` dedupe loop, or the first tenant-scoped slug index.

### `convex/routine.ts:838` (load-bearing)

`collectTopicContext` pulls a Topic's whole authoring context in one round trip. ceiling: the
comment says it returns all Lesson HTML in one query. upgrade: paginate if a Topic grows huge.

**NEEDS A TICKET**, filed 2026-09-03 as [technical-foundation 22](../.plan/maps/technical-foundation/tickets/22-materialise-read-amplification.md): correct the marker, which is factually stale, and then judge the real
amplification. The comment predates the content-blob migration. Lesson rows carry **no HTML**
today (`schema.ts:195`, `htmlStorageId` only, the inline `html` was dropped at the narrow step),
and the function hands back a signed `htmlUrl` per lesson rather than a body. So this is **not**
the same read-amplification family as
[technical-foundation/01](../.plan/maps/technical-foundation/tickets/01-slim-the-row-listlessons-collects.md),
which is about fat `translations.html` rows collected on every learner render. Two differences
that matter: the fat field here is `learningRecords.markdown`, collected in full, plus whole
`responses` and `questions` collects; and the caller is one materialise run per authoring pass,
not a per-page-view reader query. The ticket should say: fix the comment first, then decide
whether the `learningRecords` collect is worth splitting at all, with the run frequency as the
denominator. Likely answer is no, which is a fine answer once written down.

### `convex/eft.ts:27` `no-trigger`

`getRow` uses `.first()` on `operatorBank`, a table with at most one row: no index, no key.
ceiling: the singleton stays a singleton. upgrade: none stated.

**ACCEPTED.** The table is a singleton by design (money lands in one account whichever tenant
sold the course), the schema comment at `schema.ts:726` says so, and a full scan of a one-row
table is free. If the singleton ever stops being one, `schema.ts:726` is the marker that fires.

### `convex/eft.ts:56` (load-bearing)

`saveOperatorBank` repeats the five validation lines from `sellers.savePayoutDetails` rather than
extracting them. ceiling: two copies. upgrade: a third bank-details form.

**ACCEPTED**, and the reason in the comment is the right one: factoring them out would edit a
working money-adjacent function for no behaviour change. Both copies share
`payoutDetailsValidator` already, so the schema half of the duplication is already hoisted; what
is duplicated is five lines of trim-and-digits checking. Note for whoever hits the third form:
the natural home is beside `payoutDetailsValidator`, not `lib.ts` (see the `eft.ts:473` row).

### `convex/eft.ts:196`

The EFT reference is minted with a bounded retry loop rather than a counter table, because Convex
has no uniqueness constraint. ceiling: about 390k suffixes per course prefix, five attempts.
upgrade: a course selling enough for collisions to be routine.

**ACCEPTED.** The alternative is a counter row, which is a write-contention hotspot on the money
rail in exchange for a collision probability that is currently negligible.

### `convex/eft.ts:473` (load-bearing)

`tenantBrand` duplicates the one-row `by_slug` tenant read from `shares.ts` rather than hoisting
it into `lib.ts`. ceiling: two call sites, ten lines. upgrade: the third caller.

**ACCEPTED**, but **the hoist target named in the comment is wrong and should not be used.**
`lib.ts` is being emptied down to the Edition and grant core by
[technical-foundation/16](../.plan/maps/technical-foundation/tickets/16-empty-lib-ts.md) (open and
unclaimed as of 2026-09-03, `lib.ts` still 855 lines), and
[17](../.plan/maps/technical-foundation/tickets/17-rename-lib-to-edition.md) then renames what is
left to the Edition module. Hoisting a tenant-branding read into `lib.ts` now would add work to 16
and put a tenant concern inside a file whose whole point is that it holds only Edition and grant
code. When the third caller appears, the target is the tenant side: `convex/tenants.ts`, or
whichever module [18](../.plan/maps/technical-foundation/tickets/18-split-tenants-ts.md) splits it
into. The same correction applies to any other marker naming `lib.ts` as a destination: `lib.ts`
is a source in this map, never a sink.

### `convex/lib.ts:369`

`decodeEntities` decodes a hand-written map of the handful of entities that show up in plain-text
titles. ceiling: `amp`, `lt`, `gt`, `quot`, `#39`, `apos`. upgrade: extend the map when a new one
appears.

**ACCEPTED.** Six entries against a dependency or a DOM parser that Convex cannot run anyway.

### `convex/public.ts:73` `no-trigger`

`publicCourse` mirrors the row shapes of the authed reader queries as an explicit allowlist rather
than sharing them. ceiling: the shapes drift if the authed side changes. upgrade: none stated.

**ACCEPTED**, and this one is not really debt: the duplication *is* the safety property. This is
the anonymous, public-internet-facing seam, so a Guest can never receive a field unless someone
re-listed it deliberately. Deduplicating it would convert a fail-closed surface into a fail-open
one. Leave it.

### `convex/schema.ts:726`

`operatorBank` is a typed singleton table rather than a settings key/value bag. ceiling: the
fields it declares. upgrade: grow it as typed fields, like `userPrefs`.

**ACCEPTED.** Typed fields with a validator beat an untyped bag, and the upgrade path is
"add a field", which is the cheapest possible one.

### `convex/tenants.ts:16`

`TENANT_THEME_TOKENS` is hand-mirrored from `src/design/tokens.ts` because Convex functions
cannot import from `src/`. ceiling: the two lists must be kept in sync by hand. upgrade: keep them
in sync, or have issue 09 re-export a Convex-side copy, when issue 09 lands.

**NEEDS A TICKET**, filed 2026-09-03 as [technical-foundation 23](../.plan/maps/technical-foundation/tickets/23-tenant-token-mirror-has-no-test.md): add a test that asserts the two token lists are identical, because the
marker's own trigger has already fired and nothing caught it. Verified 2026-09-03: issue 09 has
landed, `src/design/tokens.ts` exists and declares itself the ONE canonical list, and the Convex
copy is still a hand-written mirror. The two agree today (both are the same 14 names), but nothing
guards them: `src/design/tokens.test.ts` checks the src list against a local literal, and
`convex/tenants.test.ts` checks a tenant row against the Convex list. No test compares the two
files, so a token added on one side ships silently wrong on the other. A test can read across the
boundary even though the runtime cannot, which is the laziest fix available.

### `convex/translate.ts:105`

Q&A translation was dropped in the routine cut-over: `materialiseTopic` exposes open questions
without replies, so a run cannot faithfully render them. ceiling: no translated Q&A. upgrade:
re-add as its own item stream if learners want it.

**ACCEPTED.** A scoped-out feature with a named trigger and a named owner of the decision
(learner demand), not an accident.

### `convex/translate.ts:670`

The translation lock table is fully scanned, mirroring `routine.claimWork`. ceiling: one row per
Topic and language. upgrade: add a `by_status` index if the edition count grows.

**ACCEPTED.** Bounded table, and the trigger is a one-line index addition when it stops being
bounded.

## src

### `src/app/_components/AdminPanel.tsx:1026` `no-trigger`

The browser's own `confirm` dialog for the one irreversible click, wrapped so the lint rule has a
single site. ceiling: one confirmation, unstyled. upgrade: none stated.

**ACCEPTED.** A native dialog instead of a modal component, for one destructive action. The
trigger, if anyone wants one, is a second confirmation appearing.

### `src/app/_components/ArtifactView.tsx:1113`

`QaDialog` is a near-twin of Dashboard's `MissionDialog`, both native `<dialog>` (free Esc,
backdrop and focus trap). ceiling: two copies. upgrade: extract on a third use.

**ACCEPTED.** Rule of three, and the shared behaviour is the platform's, not ours.

### `src/app/_components/CheckoutPage.tsx:236`

The bank guidance note hardcodes PayFast's current Instant EFT coverage. ceiling: PayFast's
present bank list. upgrade: if they restore the four banks, delete the note and the
`bankGuidance` key rather than editing it.

**ACCEPTED.** The trigger is an external event nobody polls for, which is the weakness here, but
the failure mode is a stale hint on a single-rail branch, and the named fix is a deletion.

### `src/app/_components/CourseShell.tsx:185` `no-trigger`

The payment-return landing has no timeout or failure branch: `checkoutStatus` is reactive off the
intent token, so an in-flight ITN resolves in place. ceiling: the verified norm is seconds.
upgrade: none stated, support owns the freak case.

**ACCEPTED**, deliberately and on the money rail. The decision is explicit (support absorbs the
rare stuck return) and the cheap alternative, a timeout branch, invents a UI state for a case
nobody has seen. Worth re-reading if support ever reports a stuck return, which is the trigger
this comment does not name.

### `src/app/_components/manage/SharingTab.tsx:198` `no-trigger`

The share QR code is a PNG data URL downloaded by an anchor click, with `qrcode` imported on the
click so the encoder never rides in the manage-page bundle. ceiling: 512px with a wide margin,
which is what a printed flyer needs. upgrade: none stated.

**ACCEPTED.** The dynamic import is the whole cost control, and it is already there. Note: this
marker is **newer than ticket 20**, which counted 19 on 2026-09-01.

### `src/app/_components/manage/UsersTab.tsx:15`

The users surface relocates the existing per-Edition rosters unchanged, one section per edition,
with no new backend: `listEditionAccess` stays the only query. ceiling: rosters stay split per
Edition. upgrade: ticket 22 builds the real merged list.

**ACCEPTED**, because it is already ticketed:
[ui-overhaul/22](../.plan/maps/ui-overhaul/tickets/22-build-users-surface.md), open and unclaimed
as of 2026-09-03. This is the pattern working exactly as intended, a shortcut whose upgrade path
is a real file with a number.

### `src/app/_components/manage/VoucherCard.tsx:320` `no-trigger`

The voucher CSV is built as a string and downloaded as a blob, with codes fetched on the click
rather than subscribed to so a page held open does not leak them into a screen share. ceiling: a
hand-rolled CSV. upgrade: none stated.

**ACCEPTED.** A CSV is commas and newlines, and the fetch-on-click is a security decision, not
laziness.

### `src/app/_components/markdown.ts:1`

A common-subset Markdown parser with no dependency, rendered to React elements so there is no raw
HTML and no XSS surface. ceiling: no tables, no nested lists. upgrade: swap in `react-markdown`
if a Resource ever needs those, rather than growing this.

**ACCEPTED**, and this is the model marker: named ceiling, named replacement, and an explicit
instruction not to grow the shortcut instead of replacing it.

## Totals

20 markers, 6 with no trigger. 18 accepted, 2 needing a ticket
(`convex/routine.ts:838`, `convex/tenants.ts:16`).

Harvested for
[technical-foundation/20](../.plan/maps/technical-foundation/tickets/20-ponytail-debt-ledger.md).
That ticket makes the markers visible; it fixes none of them, and neither does this file.
