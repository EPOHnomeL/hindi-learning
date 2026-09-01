---
type: grilling
blocked_by: []
---
# The tenant switch inventory, and how the switches group

## Question

What is the complete list of switches a tenant gets, and what is the relationship between them?

The operator's own phrasing is the shape of the problem: *"selling, then vouchers, then 2 types"*.
That is a hierarchy, and the current model is a flat set of six booleans with no relationships at
all. Deciding the inventory and deciding the grouping are the same act, so they are one ticket.

Three things have to come out of this sitting.

**1. Which features get a switch.** Walk the whole surface, feature by feature, and answer
switch-or-not for each with a reason. The audit done at charting (2026-09-01):

| Feature | Gated today by | Tenant switch? |
| --- | --- | --- |
| Certificates | `certificates` flag | already has one |
| Course translation / Editions | `translations` flag | already has one |
| Public anonymous links | `publicLinks` flag | already has one |
| Learner Q&A | `qa` flag **and** per-Topic `teacherQa` | already has one, double-gated |
| Course seeding | `seeding` flag, Allowlist, daily cap, `unlimited` | already has one |
| Donations | `donations` flag, payee precondition | already has one |
| Selling priced Editions | per-seller `canSell`, global `PAYFAST_MODE` | **none** |
| Bulk Vouchers (`/redeem`) | seller-ready only | **none** |
| Organisation Vouchers and Seats (`/join`) | seller-ready only | **none** |
| Manual EFT purchase rail | sys admin plus seller | **none** |
| Catalogue and publish | host-scoped only | **none** |
| Generation Routine | daily cap, `unlimited`, per-Topic provider | **none** |
| Resources and uploads | nothing | **none** |
| Emblem | nothing | **none** |
| Per-course manage Dashboard tab | nothing | **none** |
| PWA install sheet | nothing | **none** |
| Interest form and leads | nothing | **none** |
| Sharing and invites | hardwired on by whitelabel ticket 04 | ruled out, it is the admission path |

**2. How they group.** Flat set with written dependency rules ("selling off implies both voucher
switches read off"), or a real nested shape the storage knows about? Flat keeps `assertTenantFlag`
as one string lookup and keeps the storage boring; nested makes the admin surface legible once
there are fifteen of them, and makes an impossible combination unrepresentable. Whichever wins, say
what happens when a parent is off and a child is on, both in storage and at the gate.

**3. Which grain owns each feature.** The map's scope is tenant-only, so this is not a retrofit, it
is a written rule so the next feature knows where its switch belongs. Q&A is the live example of
getting it wrong twice over: `topics.teacherQa` (owner, absence means on) and `tenants.flags.qa`
(operator, required boolean) both gate the same panel with opposite defaults. State how a tenant
flag composes with a per-course setting, a per-seller grant, and the deployment kill switch.

Read the map's Notes first. They pin the verified codebase facts so this sitting does not spend
itself re-deriving them.

## Done when

- Every row of the table above has a switch-or-not answer with a one-line reason, and any feature
  the audit missed is added to it.
- The grouping is decided: flat with dependency rules, or nested, with the parent-off-child-on case
  answered for both storage and the gate.
- A written rule says which grain owns a feature's switch, and how a tenant flag composes with the
  per-course, per-seller and deployment gates. The `qa` double-gate is resolved against that rule
  explicitly, including which default wins.
- The Answer names the exact flag keys to be added, because [07](07-build-flag-storage.md) writes
  the schema straight from it.
