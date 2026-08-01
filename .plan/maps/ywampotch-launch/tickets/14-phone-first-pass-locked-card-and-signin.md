---
type: task
blocked_by: [12]
---

# Phone-first pass — the locked card and SignIn

> `/wayfinder .plan/maps/ywampotch-launch/tickets/14-phone-first-pass-locked-card-and-signin.md`

## Question

The two screens on either side of the new checkout page, both judged ugly, both
hit on a phone first. Most YWAM Potch buyers arrive from a share link on a
phone.

**`SignIn.tsx` has zero responsive classes** — `grep -cE "sm:|md:|lg:"` returns
0 — and it renders in **three** places: `AppGate` (every signed-out visitor),
`Landing`, and `_landing/YwamPotch.tsx:160`, the tenant landing page for this
launch. The operator has scoped **all of it** in, deliberately: it is the front
door buyers actually arrive at.

**The risk that comes with that, and must be managed rather than discovered:**
restyling `SignIn` changes the generic `Landing` and every other tenant's
signed-out view — surfaces nobody is testing this week. Check all three render
sites before calling it done.

The locked-lesson `Paygate` card is the other screen: gold-bordered lock, blurb,
"Unlock full course", the price, the PayFast/pending-EFT note. Its CTA becomes
the entry to the checkout page per ticket 12. It carries `md:` ×2 and `sm:` ×1
today — the thinnest responsive treatment of any learner surface.

**Bespoke and disposable, by decision.** Do not extract shared design tokens, a
type scale or a breakpoint system — [ui-overhaul](../../ui-overhaul/map.md) owns
the real foundation and will redesign these surfaces properly later. Style these
screens well and leave the rest of the app alone.

## Done when

`SignIn` and the locked `Paygate` card hold up at phone width with no overflow
and no broken wrapping, and the operator has walked both in dev and is happy.
All three `SignIn` render sites checked — `AppGate`, `Landing`, and the YWAM
Potch tenant landing page. No shared design tokens or breakpoint system
extracted. `pnpm typecheck` and `pnpm test` green.
