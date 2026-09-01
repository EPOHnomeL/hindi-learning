---
type: task
blocked_by: [09, 11, 12, 13]
---
# Walk the switches on prod, on a real tenant host

## Question

HITL. A human, on `ywampotch.my-course.app` or another real tenant host, flipping switches and
watching things appear and disappear. Nothing in this map is done until that has happened.

This ticket exists because the whitelabel map learned the lesson the expensive way: eight tickets
went green on static gates alone and sat unverified for a month, and six of them only cleared when
the operator finally walked prod on 2026-08-01. Typecheck and unit tests cannot see a flash, a
button that fails to disappear, or a nav item that leaves a hole.

Prod is the only place with real tenant accounts and real tenant data. Dev holds two operator
accounts and nothing else, so a dev walk proves very little here. Flip switches through the admin
Tenants tab, not by patching data.

**Do not test selling by making a real purchase.** The rail is live and takes real money. Verify
that the Buy affordance appears and disappears, and stop at the checkout boundary.

## Done when

- [ ] For each switch, on a real tenant host: on shows the affordance, off removes it, and the
      change is visible without a hard reload.
- [ ] The loading behaviour [06](06-the-client-hide-seam.md) picked is what actually happens on a
      cold load over a real connection. Specifically: no gated affordance flashes in and then
      vanishes, unless 06 chose that deliberately.
- [ ] The apex `my-course.app` behaves as [04](04-is-the-default-site-switchable.md) decided,
      checked directly rather than assumed.
- [ ] A tenant-admin session sees what [05](05-who-may-flip-which-switch.md) decided, checked with a
      real tenant-admin account rather than a sys admin.
- [ ] Frozen-not-revoked is confirmed by eye on at least one real artifact: a claimed certificate, a
      translated Edition, or a purchased Edition still resolves after its switch goes off.
- [ ] The Answer distinguishes **walked in a browser** from **verified by reading the code** for
      every line above, per CLAUDE.md, and names the host and the date.
- [ ] Any switch that fails the walk gets its own follow-up ticket on this map rather than a note
      here.
