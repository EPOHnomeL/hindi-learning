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

## Answer

**One route: `src/app/(app)/checkout/[slug]/[lang]/page.tsx` → `/checkout/<slug>/<lang>`.**

**Inside `(app)`, and that is the whole answer for path A.** `(app)/layout.tsx`
is nothing but `<AppGate>`, and `AppGate` renders `<SignIn/>` *at the current URL*
without redirecting (ADR 0012) — so a signed-out visitor hitting the checkout URL
gets the account step for free, then re-renders into the checkout page at the same
URL after auth. **The operator chose this over the alternative** (checkout outside
the auth wall, sign-in form inlined into the wizard body): the complaint was
*popups*, and `SignIn` is a full page, not a popup. Inlining would have put new
auth code on the surface that takes money, in launch week, and created a second
sign-in form beside the one that already renders in three places.

It is a **sibling of `courses/`, not a child**, so it does *not* inherit
`courses/[slug]/layout.tsx`'s `CourseShell` — no sidebar, no reader chrome, no top
bar. A bare mobile-first page is the point of the ticket, and route nesting is what
delivers it.

**`lang` is a required path segment, not `?lang=`.** Omitting the language is
precisely the prod checkout bug documented in `editionUrl.ts`'s header — an
implicit language lets `resolveEdition` serve a free published translation instead
of the paid Edition's paygate, silently replacing the buy flow with free content. A
required segment cannot be forgotten by a future caller; a query param can. Always
explicit, `en` included.

**One route, step state internal — no step-per-URL.** Not a launch-week
concession: there is no in-page state worth a URL. Every step is derivable from
the *server*, so back/forward/refresh already behave. `eft.myEftIntent` re-derives
step 3 on mount, and the card step is a top-level form-POST navigation away to
PayFast — it leaves the app entirely. Per-step URLs would buy resumability Convex
already gives us, at the cost of the most routing to get right in the week the
money path changes.

### The two entry paths

- **A — share link, signed out.** `PublicReader` → `Paygate` renders `buyHref` as
  a `<Link>` → **`/checkout/<slug>/<lang>`** → `AppGate` renders `SignIn`
  (step 1 **live**) → after auth, same URL re-renders as the checkout page
  (step 2). `PublicReader`'s `buyLink()` retargets here and drops `buy=1`; it no
  longer needs `kind` or `key`, because the buyer no longer detours through a
  locked lesson in the authed app to reach a dialog. **That detour screen is
  deleted** — having clicked "Unlock full course" on the share page, a second
  locked page with a second Unlock button is a wasted screen on the abandonment
  path we are here to fix.
- **B — published site, signed in.** `ArtifactView` → `Paygate` → "Unlock full
  course" is now the *same* `<Link>` to the same route (step 1 **already ticked**).

So `Paygate`'s CTA becomes **always a link, on both paths** — the `buyHref` /
button fork in `Paygate` collapses to one branch. Nothing about the page needs to
know which path the buyer came in on; the rail's own state carries the difference.

### `buy=1` and `autoOpenBuy` are both deleted

They exist for exactly one job — reopening a dialog across an auth hop. The route
now survives the hop, so the job is gone. Concretely, for ticket 13:

- `Paygate`: the `autoOpenBuy` prop, the `buying` state, and the `<BuyDialog>`
  mount all go (13 deletes `BuyDialog` itself).
- `editionUrl.ts`: `useBuyMarker()` goes, with its two `ArtifactView` call sites
  (lines 406/473 and 808/843) — those are its only consumers besides `SignIn`.
- `SignIn`: keys the rail and the `signUp` default off **being on a checkout
  path** — `usePathname()?.startsWith("/checkout")` — instead of the marker. Same
  two behaviours, self-describing trigger, one less query param to preserve.
- `readerDerive.ts`'s `courseIndexRedirect` **stays**: its `purchase`/`mp`
  carrying is still load-bearing for the payment-return banner. Only the `buy=1`
  case in `readerDerive.test.ts:49` goes stale — 13's call whether to retarget or
  drop that assertion.

**No auth change is needed.** `oauthRedirectUrl` (`convex/lib.ts:724-748`)
validates the **host only** — protocol, port, and apex/subdomain boundary — and
never inspects the path. `SignIn` already passes `window.location.href` as
`redirectTo`, so a `/checkout/...` URL round-trips through Google and returns to
the tenant subdomain under ADR 0025's host-only cookie, unchanged.

### Rail versus body

- **Rail** — the existing `CheckoutSteps` and *nothing else*: four one-word steps,
  ticked / bold / quiet, not clickable. Resist adding the course or price to it.
  The one-word labels are load-bearing (see the comment above the component): four
  labels plus markers measure ~275px, and French and Hindi are longer still. It
  holds one line on a phone only because it carries nothing else.
- **Body** — the course + edition + price summary, persistent across steps 1–3
  (from the existing `api.content.reader.courseHeader` query, `{topicSlug, lang}`
  → `title` + `paywall`; already read-only, already used by both readers), then
  the current step's content, then the terms/refunds fine print. Step 3's content
  is `EftInstructions` — reference and bank details, loudest things on the page.

This is deliberately the same content `BuyDialog` renders today. **The page is a
re-container, not a redesign**: 13 moves it, 14 does the phone-first pass, and per
the map's rules the operator's eye is the bar for both.

### Resume, for a pending EFT intent

A buyer with a pending intent who lands on `/checkout/<slug>/<lang>` — days later,
from either entry path — sees the instructions panel with their reference
immediately, because `eft.myEftIntent` is queried on mount exactly as the dialog
queries it today. Two ways in: the locked `Paygate` card's existing pending-EFT
note gains a link to the route, and **the URL itself is now bookmarkable and
sendable to yourself** — the one thing a dialog could never be, and the reason
this ticket is worth its own page rather than a wider modal.

### `convex/` needs no change — confirmed

`market.startCheckout` and `eft.startEftPurchase` both take `{topicSlug, lang}`,
and both are in the route params. `courseHeader` likewise. Nothing else is called.

**This also resolves the "payment-return landing" fog patch, and the answer is
"leave it alone".** PayFast's `return_url` is minted **server-side**
(`convex/market.ts:432`) to `/courses/<slug>?purchase=return&mp=<token>` — so a
card buyer coming back from PayFast never re-enters checkout at all. They land on
the course with `CourseShell`'s reactive `ConfirmingBanner`, which flips to the
unlocked content the moment the ITN grants the Entitlement. That *is* step 4
("Continue to your course"), and it is already correct from the new route.

One wart, named so ticket 15 doesn't rediscover it as a bug: `cancel_url` is the
bare `/courses/<slug>`, so a buyer who **abandons** at PayFast lands on the course
index and must click "Unlock full course" again rather than returning to their
checkout page. Fixing it would be a `convex/` change, which 13 forbids and which
touches the file that holds real money. Accepted as-is.
