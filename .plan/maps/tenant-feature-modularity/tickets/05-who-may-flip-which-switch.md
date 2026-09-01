---
type: grilling
blocked_by: [01]
---
# Who may flip which switch

## Question

`setTenantFlags` is **sys-admin-only** today, and the code says why: *"the flags decide what the
tenant may do at all, so flipping one widens the tenant's own grant, which is provisioning and
never a tenant admin's"*. The scoped check was deliberately removed in favour of the unscoped one.

That reasoning is airtight for money. It is much weaker for the rest, and the inventory from
[01](01-the-tenant-switch-inventory.md) is about to make the list long enough that "ask the
operator" becomes the bottleneck it was not when there were six.

Sort the inventory into who may flip each switch, and give the sorting rule rather than the list:

- **Money switches**, where a flip changes what flows through the operator's single merchant
  account or creates a payable: selling, both voucher rails, EFT, donations. `donations` already
  carries the strongest precedent, a hard precondition (payee set and a ready seller) enforced with
  a `ConvexError` so the message survives prod redaction.
- **Cost switches**, where a flip spends the operator's model budget rather than their money
  directly: generation, translation, seeding. These are not payables, but they are not free either,
  and the existing daily cap plus the `unlimited` grant is the current answer to the same question
  at a different grain.
- **Presentation switches**, where a flip changes only what the tenant's own members see:
  certificates, public links, Q&A, the install sheet, the interest form, the manage Dashboard tab.

For each bucket, say sys admin only or tenant admin too, and say what a tenant admin sees for a
switch they may read but not flip: hidden entirely, or shown disabled with a reason. Shown-disabled
is a discoverability feature, and it also tells a tenant admin exactly what to ask the operator for.

Two follow-ons the answer needs to cover:

- **Preconditions beyond role.** `donations` cannot be switched on without a ready payee. Does
  `selling` need the same shape, given that a tenant with no ready Seller who switches selling on
  gets a feature that cannot be used? Say whether preconditions generalise or stay one-offs.
- **Audit.** A flag flip currently writes no record of who flipped it or when. With money switches
  and two tiers of admin, say whether that stays acceptable.

## Done when

- Every switch from 01 is assigned to a bucket, and each bucket has a who-may-flip answer.
- The sorting rule is stated in one sentence, so a switch added later sorts itself.
- The read-but-not-flip presentation is decided: hidden, or disabled with a reason.
- Preconditions are settled, either generalised into a rule or confirmed as one-offs with
  `donations` the only instance.
- The audit question is answered yes or no, and if yes the shape is named for
  [07](07-build-flag-storage.md).
