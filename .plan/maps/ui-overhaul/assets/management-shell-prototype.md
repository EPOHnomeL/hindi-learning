# Management shell prototype: the record and its verdict

Ticket: [16, management shell prototype](../tickets/16-management-shell-prototype.md).

## Question

Every act of managing a course happened in one `max-w-lg` `Dialog` with up to nine
concerns in a flat scroll. What should the container be, dialog, bottom sheet or route,
and how should the phone-first layout inside it be organised?

## How to run it

```
pnpm dev        # and, in another terminal, pnpm dev:backend
```

```
/courses/<slug>/manage-prototype?variant=A     dialog, accordion
/courses/<slug>/manage-prototype?variant=B     bottom sheet, docked above the app tab bar
/courses/<slug>/manage-prototype?variant=C     route, sticky sub-nav
```

The pill at the bottom centre cycles the variants; left and right arrow keys do the same.
It never renders in a production build. Code:
`src/app/_components/EditionsManagementPrototype.tsx`, mounted at the throwaway route
`src/app/(app)/courses/[slug]/manage-prototype/page.tsx`.

Real Convex reads: `api.translate.editions`, `api.sellers.sellerStatus`. Every toggle, the
invite field, the roster, the price and the voucher mode are local state, not real
mutations, per the prototype skill's read-only rule.

## The three candidates

| | Container | Layout inside |
|---|---|---|
| **A** | The existing `Dialog` | Ticket 15's three groups as an accordion, one open at a time |
| **B** | A bottom sheet, docked above the app-level tab bar that shipped 2026-08-23 | The same three groups, flat, behind a sticky segmented jump-nav instead of an accordion |
| **C** | A route, `/courses/[slug]/manage` | Edition picker plus a segmented sub-nav as the sticky page header, sections underneath |

All three carry the same content: the edition picker, and ticket 15's three groups (Who
can find it: Publish; Who you hand it to: Public link and Invite; What it costs: Price
plus the merged voucher control, collapsed to one row for anyone who is not a ready
Seller).

## Known prototype shortcuts

- English strings, no `next-intl`. Real work must go through the `Editions` and `Common`
  namespaces.
- No swipe gestures, no drag-to-dismiss on the sheet.
- The roster shown is seeded local state, not `shares.listEditionAccess`.

## Verdict, decided 2026-08-27

**C wins**, confirmed by the operator after reviewing all three. It was the ticket's own
prior going in, and it held up once built: no dialog stacking (A nests a `<dialog>` inside
whatever opened it), deep linkable and reload stable the same way Settings became a route
over a sheet on 2026-08-23, and its sticky sub-nav keeps the active group visible through
scroll where A's accordion only shows the one group that is open. B's second bar (tab bar
plus sheet header plus sheet sub-nav) cost more vertical space at 360px than either A or
C, for no offsetting gain.

Full reasoning, the seam table for `Editions.tsx`, and what the shell owes the Users and
Course settings peers are in [ticket 16's Answer](../tickets/16-management-shell-prototype.md#answer).

## Corrected mid-prototype, same date

Ticket 17 resolved concurrently with this prototype and moved the access roster off the
per-Edition sharing panel onto its own course-scoped Users surface. The prototype
originally listed the roster inside "Who you hand it to"; Variant C was reworked before
this ticket resolved to a top-level peer nav (Sharing, Users, Settings) so the shell
matches what ticket 17 actually decided, sharing per Edition under the picker, Users and
Settings course-wide beside it. Variants A and B were not reworked to match, since neither
won.

## Watch this one on the way out

This prototype route and its switcher are throwaway. Ticket 19 (build the sharing
surface) should delete `EditionsManagementPrototype.tsx` and the
`manage-prototype/` route once the real shell lands, the same way the 2026-08-23
bottom-nav prototype code was deleted once variant D shipped as production.
