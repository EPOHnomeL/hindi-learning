---
type: research
---
# Which share and sell rails has anyone actually used

> `/wayfinder .plan/maps/ui-overhaul/tickets/14-rail-usage-evidence.md`

## Question

The Editions and sharing dialog offers **six** ways to hand a course to someone.
Before ticket 15 argues about which survive, count what production has actually
seen.

Per rail, from the **production** Convex deployment: how many rows exist, how many
distinct Topics use it, how many belong to a real tenant rather than a test course,
and the date of the most recent one. Lifetime sales are around ten, so these are
countable by hand, not sampled.

The rail-to-table mapping was verified against `convex/schema.ts` and
`src/app/_components/Editions.tsx` on 2026-08-27, so no session needs to re-derive
it. Grant is the first table, take-up the second:

| Rail | Control | Grant table | Take-up |
| --- | --- | --- | --- |
| Publish to catalogue | `catalogue.setEditionPublished` | `publishedEditions` (`published: true`) | `enrollments` (free self-enroll, ADR 0023) |
| Anonymous public link | `shares.setEditionPublic` | `publicLinks` **plus** `topics.publicToken`, see below | none recorded |
| Invite by email | `shares.shareTopic` | `shares`, `pendingShares` (invite to an address with no account) | n/a |
| Set a price | `market.setEditionPrice` | `listings` | `entitlements` (`pfPaymentId` is PayFast, `eftRef` is manual EFT) |
| Batch of single-use vouchers | `vouchers.mintBatch` | `voucherBatches`, `vouchers` | `vouchers.redeemedAt` |
| One shared organisation code | `accessCodes.mintAccessCode` | `accessCodes` | `seats` (count via `by_access_code`) |

The public-link rail stores itself two ways, and the split is the "older access-code
rail" this ticket originally listed as a seventh rail: English keeps the legacy
course-level `topics.publicToken` (ADR 0013) so existing links never break, while
every other language gets a per-Edition `publicLinks` row (`convex/shares.ts:158`).
Count both. There is no seventh rail and no separate access-code table. ADR 0031's
`accessCodes` is the only one.

Read via the Convex MCP (`data`, `runOneoffQuery`) or `convex data --prod`. **Do not
write anything.**

## Done when

The Answer carries one line per rail with its row count, distinct-Topic count and
last-used date, and names the rails with zero real usage. Any rail whose count
cannot be read is listed as unknown with the reason, not guessed.
## Answer

Read from the production deployment `capable-barracuda-769` on 2026-08-27, whole-table
reads at the row grain, no sampling. Counts are exact.

**One course carries every rail.** `prophetic-school` (the `ywampotch` tenant) is the
only Topic that has used more than two of the six, and it is the only Topic that has
ever earned money. Strip it out and five of the six rails have no real usage at all.

| Rail | Rows | Distinct Topics | Real, not a test course | Last used |
| --- | --- | --- | --- | --- |
| Publish to catalogue | 5 published, 3 flipped back to `false` | 4 | 3 (`prophetic-school` en+af, `the-practice-of-prayer`, `india-prayer-journey-preparations`) | 2026-08-18 |
| Public link, per Edition (`publicLinks`) | 25 | 3 | 2 (23 of the 25 are `prophetic-school` translations, one per language) | 2026-08-13 |
| Public link, legacy (`topics.publicToken`) | 19 | 19 | 18 | n/a, no timestamp of its own |
| Invite by email (`shares`) | 68 | 14 | 13 | 2026-08-21 |
| Invite by email, unclaimed (`pendingShares`) | 31 | 3 | 3 (29 of the 31 are `prophetic-school`) | 2026-08-21 |
| Set a price (`listings`) | 2 | 1 | 1 (`prophetic-school` en+af, R100 each) | 2026-07-22 |
| Paid access granted (`entitlements`) | 20 | 2 | 1 | 2026-08-25 |
| Batch of single-use vouchers | 1 batch, 5 codes, 1 redeemed | 1 | **0** | 2026-08-18 |
| One shared organisation code | 1 code, capacity 2, stopped, 2 seats taken | 1 | 1 | 2026-08-25 |
| Free self-enroll (`enrollments`, ADR 0023) | **0** | 0 | 0 | never |

### Rails with zero real usage

- **Vouchers.** The single batch ever minted is on `test-course`, 5 seats, R0 relevant,
  one code redeemed by whoever was testing. No organisation has ever bought one. This
  rail has never been used in earnest.
- **Free self-enroll.** The `enrollments` table is empty. ADR 0023's fifth access
  primitive has never granted anybody anything, which also means the "publish it free
  and let members join" flow has never once completed in production.

### What the numbers say that the counts alone do not

- **Sales are one course, one price.** 17 paid Entitlements, 14 PayFast and 3 manual
  EFT, all `prophetic-school`, plus 3 Admin or legacy grants and 1 on `test-course`.
  The EFT rail (ADR 0026) is genuinely load-bearing at roughly one sale in six.
- **The legacy public-link rail is the widely-used one.** 19 Topics carry a
  `topics.publicToken`; only 3 have a `publicLinks` row. Whatever ticket 15 decides,
  the rail with real breadth is the older storage shape, not the newer one, so
  "retire the legacy field" is a data-migration question and not a UI cleanup.
- **31 invites were sent to addresses that never signed up**, 29 of them for one
  course, against 68 Shares that did land. Nearly a third of all invites are sitting
  unclaimed. That is a funnel problem in the invite rail rather than an argument about
  its card.
- **Editor is a real role, not a corner.** 25 of 68 Shares are `editor`, 13 explicit
  `viewer`, 30 legacy rows with no role at all.
- **The access-code rail works and is the freshest thing on the panel.** One code,
  capacity 2, both seats taken by real accounts, stopped and settled, most recent
  activity 2026-08-25. Small, but it is the only bulk rail with a real customer.
- **Publish gets switched off again.** 3 of the 8 `publishedEditions` rows are
  `published: false`, so owners are unpublishing about as often as ticket 15 might
  assume they publish.

Method note: the Convex MCP could not authenticate even after `npx convex dev`, so
these came from `CONVEX_DEPLOY_KEY= pnpm exec convex data --prod`. Clearing that
variable matters. Left set, the CLI silently ignores `--prod` and reads the dev
deployment `judicious-marmot-580` instead. Personal data (invite emails, seat
nicknames) and bearer secrets (link tokens, voucher codes) were stripped in the pipe
and never written to disk.
