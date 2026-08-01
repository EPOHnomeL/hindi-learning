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

## Answer

Done as a pure presentation pass — `convex/` untouched, no new abstraction, every
change a local Tailwind utility on the three files that render these two screens.
`pnpm typecheck` clean; `pnpm test` **758/758 green in 66 files**, including the
`convex/sales.test.ts` flake the map warns about, which passed this run.

**The one real bug, and it wasn't the ugliness: the step rail overflows a 320px
phone.** Ticket 09 sized `CheckoutSteps` against a 384px sign-in card and left a
note saying four labels plus markers measure ~275px, "so the row holds one line
in every locale". That was measured against the card, not the phone. The rail's
own box carries `px-4`, so on a 320px screen (`px-4` page + `px-4` box) it has
**~256px**, and `whitespace-nowrap` — deliberately, per 09 — turns the shortfall
into visible overflow rather than a silent wrap. It fits a 375px iPhone and
breaks on an SE or a small Android. Afrikaans is the longest of the five locales
(`Rekening | Metode | Betaal | Kursus`), not French or Hindi as 09 guessed.

Fixed by making the **small size the base** and `sm:` the roomier one — the
honest mobile-first inversion rather than a special case: `text-[10px]`, `h-4`
markers, `w-1.5` separators, `gap-0.5`, landing near ~220px. The rail's box also
drops to `px-2` on a phone in **both** hosts (`SignIn` and `CheckoutPage`'s
`Shell`) — same bug, same rail, so both were corrected even though the page is
ticket 13's surface.

**The locked `Paygate` card.** The CTA row was `flex flex-wrap` with the button
first and the price second: at 320px the pair needs ~280px in ~260px of card, so
it wrapped and dropped the price *under* a left-aligned button in a ragged L —
the price landing downstream of the button that commits to it. Now the price
comes **first in the DOM** and they stack on a phone (price, then a full-width
CTA); `sm:flex-row-reverse sm:justify-end` restores the exact desktop shape the
card already had (button left, price right) without a second markup path. Card
padding `p-6` → `p-5 sm:p-7`, lock badge `h-10 sm:h-11`, `min-h-[60vh]` → `svh`.

**`SignIn`, which had literally zero responsive classes.** `min-h-screen` →
`min-h-svh` — `100vh` on a phone excludes the browser chrome, so a screen that
exactly fits gains a scrollbar and a rubber-band jog as the URL bar hides. Added
`py-8` (the card is taller than a small phone; without it the logo clips at the
top instead of scrolling), `gap-5 sm:gap-6`, logo `h-14 sm:h-16` with
`max-w-[min(16rem,100%)]` instead of a flat `max-w-64`, tenant name
`text-xl sm:text-2xl` + `text-balance`, form `p-5 sm:p-6`. Separately: the Google
button, both inputs and the submit sat at **40px** tall — under the 44px thumb
minimum — so they went to `py-2.5`, and the flow toggle got `py-1`.

**All three `SignIn` render sites checked**, as the ticket demanded: `AppGate`
(bare, inside its own `min-h-screen` main), `Landing.tsx:199` and
`_landing/YwamPotch.tsx:160` — the last two identical, `<SignIn />` alone inside
a `.cert-stage` section. None overrides or wraps `SignIn`'s own classes, so the
change lands the same way in all three; the leak the ticket warned about is real
but every effect of it is an improvement (`svh` and `py-8` shorten and pad that
full-bleed section on a phone, and nothing else moves). The generic `Landing` and
every other tenant's signed-out view get the same phone fixes.

**Bespoke and disposable, as decided** — no design tokens, no type scale, no
breakpoint system. `CheckoutSteps` was already shared by these two hosts; nothing
new was extracted, and [ui-overhaul](../../ui-overhaul/map.md) still owns the
real foundation.

**The operator's walk in dev is still owed** — same bar as 13, 16 and 17, and
this ticket's Done-when names it explicitly. Nothing here was seen in a browser:
the widths above are computed from the type sizes and padding, not measured, and
this repo has no browser test to measure them with (vitest covers pure logic
only, and there is no Playwright). The 320px arithmetic is the claim most worth
checking with a real thumb.
