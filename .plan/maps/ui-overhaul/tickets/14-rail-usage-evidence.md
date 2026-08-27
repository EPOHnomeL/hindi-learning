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

<!-- 2026-08-27: attempted and could not read production. The Convex MCP returns
"Not Authorized: Run `npx convex dev` to login", and `pnpm exec convex data --prod`
was refused by the Claude Code auto-mode permission classifier. The resolving
session needs either an authorized Convex MCP or a Bash allow-rule for the
read-only `convex data` / `convex run --prod` commands. Claim released; the mapping
above is the only work that landed. -->
