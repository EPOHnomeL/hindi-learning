---
type: grilling
blocked_by: []
---

# Checkout as a page — the route, the two entry paths, and the step model

> `/wayfinder .plan/maps/ywampotch-launch/tickets/12-checkout-page-route-and-step-model.md`

## Question

Checkout is a popup today and the operator wants it to be **its own mobile-first
page** — a flight-booking-style wizard, step rail at the top, showing what's done
and what's left. The step *sequence* is right (Account → Method → Pay → Course)
and is not up for debate; the **container** is what changes. This ticket decides
the shape everything else hangs off. Nothing else in the strand can start until
it closes.

**The two entry paths, verified in code — both must land on the same page:**

- **A — public/share link, signed out.** `/share/[token]/lessons/…` →
  `PublicReader` → `Paygate` renders a **link** (`buyHref`, built by
  `buyLink()` in `editionUrl.ts`) → `/courses/<slug>/lessons/<key>?buy=1` →
  `AppGate` renders `SignIn` because the visitor is unauthenticated → after auth,
  back to that URL → `autoOpenBuy` fires the dialog.
- **B — published site, already signed in.** `ArtifactView` → `Paygate` →
  "Unlock full course" → dialog opens in place.

So step 1 is a **live step** on path A and **already ticked** on path B. The page
must do both without feeling like two different products.

Decide:

- **Where the route lives.** There is no `/checkout` route today — `src/app` has
  `(app)`, `(legal)`, `share`, `certificate`. Under `(app)` it inherits
  `AppGate`'s auth wall, which renders `SignIn` for signed-out visitors *for
  free* — that may be the whole answer for path A, or it may be exactly the
  two-containers problem the operator is trying to get rid of.
- **One route or a step per URL.** `/checkout/<slug>/<lang>` holding step state
  internally, vs `/account`, `/method`, `/pay` as real URLs. Per-step URLs make
  back, forward, refresh and "send yourself the link" work properly on a phone;
  they are also the most routing to get right in a launch week.
- **What happens to `?buy=1` and `autoOpenBuy`.** Both exist only to reopen a
  dialog across an auth hop. With a real route, are they deleted, or does
  `buy=1` survive as the marker that puts the step rail on `SignIn`?
- **What "what you've done and what you still need" actually shows.** Ticked
  steps and a bold current one is what exists (`CheckoutSteps`). On a page there
  is room for more — the course, the price, the chosen method, the reference.
  What belongs in the rail and what belongs in the page body?
- **Resuming.** A buyer with a pending EFT intent who comes back days later:
  where do they land, and from which entry point? Today `myEftIntent` re-shows
  the instructions inside the dialog.
- **`convex/` stays untouched** — same `market.startCheckout` and
  `eft.startEftPurchase` mutations. Confirm nothing here forces a server change.

## Done when

The Answer records: the route (or routes) and where they live in `src/app`;
how each of the two entry paths reaches it and what step 1 does in each; the
fate of `buy=1` / `autoOpenBuy`; what the step rail shows versus the page body;
the resume behaviour for a pending EFT intent; and confirmation that `convex/`
needs no change. Enough that tickets 13 and 14 can be built without reopening
any of it.
