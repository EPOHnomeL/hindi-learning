---
type: task
blocked_by: [05, 07]
---
# Build: the admin Flags surface for a grown inventory

## Question

The Flags section in the Tenants tab is a flat list of six plain switches driven by `FLAG_META` in
`AdminPanel.tsx`. At roughly fifteen switches with parent-child relationships and two tiers of
permission, a flat list stops being a surface and becomes a wall.

Rebuild it for the inventory [01](01-the-tenant-switch-inventory.md) landed on and the permissions
[05](05-who-may-flip-which-switch.md) assigned:

- **Grouping.** Whatever 01 decided about parents and children needs to be legible here. Selling
  with the two voucher rails and EFT nested under it is the operator's own mental model, and a flat
  alphabetical list actively fights it.
- **Permission.** 05 decided what a tenant admin sees for a switch they may read but not flip:
  hidden, or shown disabled with a reason. Implement exactly that. If disabled-with-a-reason won,
  the reason has to say what to ask the operator for, or it is just a greyed box.
- **Preconditions.** `donations` already refuses to switch on without a ready payee, and throws a
  `ConvexError` so the message survives prod redaction. If 05 generalised preconditions, the surface
  needs to show why a switch cannot be turned on **before** the operator clicks it, not after.
- **No confirm dialog, still.** Flag-off is frozen-not-revoked, so a flip grants nothing and deletes
  nothing. Ticket 21 of the whitelabel map decided this deliberately; do not add one.

Keep the existing per-key busy flag that guards a double-click mid-write, and keep the live
`getTheme` query driving the displayed state so a toggle reflects immediately.

## Done when

- [ ] The Flags section renders 01's grouping, not a flat list, and a child switch's relationship to
      its parent is visible without reading documentation.
- [ ] A tenant admin sees exactly what 05 decided for a switch they may read but not flip, tested
      against both a sys-admin and a tenant-admin session.
- [ ] A switch blocked by a precondition says so before it is clicked, with the actionable reason.
- [ ] No confirm dialog was added, and the Answer says so explicitly.
- [ ] The per-key busy guard and the live `getTheme` reactivity both still work.
- [ ] `FLAG_META` and `setTenantFlags`'s args are in sync with the validator, by whatever mechanism
      [07](07-build-flag-storage.md) established.
- [ ] `pnpm typecheck` and the unit suite are green.
