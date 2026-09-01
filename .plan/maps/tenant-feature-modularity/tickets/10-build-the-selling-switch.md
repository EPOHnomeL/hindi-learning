---
type: task
blocked_by: [02, 05, 07, 08]
---
# Build: the selling switch

## Question

Give selling a tenant grain. This absorbs
[course-publishing ticket 11](../../course-publishing/tickets/11-per-tenant-selling-flag.md), which has been
fully scoped and unbuilt since 2026-07-18. Read it and that map's ticket 02 before starting; this
ticket builds their decision as amended by [02](02-what-off-does-to-live-data.md) here.

**This touches the live money rail.** Prod has taken real purchases since 2026-07-29 on the
operator's live merchant. Do not refactor `convex/payfast.ts` or `market.startCheckout` while
passing through, do not test against prod, and remember the ordered-array signature constraint on
`buildCheckoutFields` that the tests pin.

The gate composes with two existing ones rather than replacing either: the deployment-wide
`sellingEnabled()` (`PAYFAST_MODE`) and the per-seller `isReadySeller`. 01's grain rule says how all
three read together, and the Answer should state the composed truth table plainly, because three
independent gates on a money path is exactly the kind of thing the next session gets wrong.

**Done 2026-09-01: `course-publishing/11` now carries an Answer pointing here**, written
during the `.plan` consolidation, so the two maps no longer disagree about who owns the flag.
That Answer is explicit that it records a *transfer* and not a build. Read that ticket's
Question for the fully-scoped migration; it is the version this ticket inherits, and nothing
in it has shipped.

## Done when

- [ ] `assertTenantFlag(ctx, tenantSlug, "selling")` gates `market.setEditionPrice` and
      `market.startCheckout`, composed with `sellingEnabled()` and `isReadySeller` per 01's rule.
- [ ] `market.clearEditionPrice` stays **un-gated**, so an owner can always drop a stuck price back
      to free, with a test pinning it.
- [ ] Everything 02 decided about a mid-flight checkout intent and a pending EFT intent is
      implemented and tested.
- [ ] Existing buyers keep access and existing listings persist with the switch off, tested.
- [ ] The price affordance, the Buy button and the checkout route hide behind the
      [08](08-build-the-client-flag-seam.md) seam when the switch is off.
- [ ] Any precondition [05](05-who-may-flip-which-switch.md) required (for example a ready Seller
      before selling can be switched on) is enforced in `setTenantFlags` as a `ConvexError`, not a
      plain `Error`, so the message survives prod redaction.
- [ ] The composed truth table for the three gates is written into the Answer.
- [ ] [course-publishing ticket 11](../../course-publishing/tickets/11-per-tenant-selling-flag.md) is resolved
      with an Answer pointing here, and that map's line about it being unbuilt is corrected.
- [ ] `pnpm typecheck` and the Convex suite are green.
