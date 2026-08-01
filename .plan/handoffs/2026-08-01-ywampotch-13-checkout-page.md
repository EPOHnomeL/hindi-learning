# Handoff — ywampotch-launch, ticket 13: move the purchase onto the checkout page

**Date:** 2026-08-01 · **Previous session:** resolved ticket 12 (grilling, planning only — no code written)

## Where the map stands

Ticket 12 is answered, so **13 and 14 are both on the frontier and independent of
each other** — they can run in parallel sessions. 15 stays blocked on both.

Start the next session with:

```
/wayfinder .plan/maps/ywampotch-launch/tickets/13-move-purchase-out-of-buydialog.md
```

Read [ticket 12's `## Answer`](../maps/ywampotch-launch/tickets/12-checkout-page-route-and-step-model.md)
in full before writing anything — it is the design 13 implements, and it names the
exact call sites to change. Nothing in it is open for reopening; if you find a
reason it must be, that is a map edit, not a quiet deviation.

## What 12 decided, in one breath

Checkout becomes **one route, `/checkout/<slug>/<lang>`**, at
`src/app/(app)/checkout/[slug]/[lang]/page.tsx`. Inside `(app)` so `AppGate`
renders `SignIn` at that URL for free (that is the whole signed-out share path);
a **sibling of `courses/`**, so it inherits no `CourseShell` chrome — bare,
mobile-first. `lang` is a **required path segment**, never `?lang=`. Step state is
internal; no step-per-URL. `BuyDialog` is deleted and `Paygate`'s CTA becomes
always a `<Link>` to the route on both entry paths.

## The concrete edit list 13 inherits

- **New** `src/app/(app)/checkout/[slug]/[lang]/page.tsx` — everything `BuyDialog`
  renders today, as page sections: summary (title/edition/price), the
  "How do you want to pay?" chooser, `EftInstructions`, pending-EFT state, error
  line, PayFast note, terms/refunds line. `CheckoutSteps` at the top and
  **nothing else in the rail**.
- **`Paygate.tsx`** — delete `BuyDialog`, the `autoOpenBuy` prop, the `buying`
  state and the dialog mount; collapse the `buyHref`/button fork to a single
  `<Link>`. The pending-EFT note on the locked card gains a link to the route.
- **`PublicReader.tsx:64`** — `buyLink()` retargets to `/checkout/<slug>/<lang>`
  and drops `buy=1`; it no longer needs `kind` or `key`.
- **`editionUrl.ts`** — delete `useBuyMarker()`.
- **`ArtifactView.tsx`** — drop `buyMarker` and the `autoOpenBuy` pass-through at
  lines ~406/473 (lesson) and ~808/843 (reference).
- **`SignIn.tsx`** — swap `useBuyMarker()` for
  `usePathname()?.startsWith("/checkout")` as the trigger for both the step rail
  and the `signUp` default. No other behaviour change (14 owns its styling).
- **`readerDerive.test.ts:49`** — the `buy=1` assertion goes stale. Keep
  `courseIndexRedirect` itself: its `purchase`/`mp` carrying is still load-bearing
  for the payment-return banner. Retarget or drop that one case; your call.
- **Data:** `api.content.reader.courseHeader` `{topicSlug, lang}` gives `title` +
  `paywall`. Already exists, already read-only.

## Facts already verified — don't re-derive them

- **No auth change needed.** `oauthRedirectUrl` (`convex/lib.ts:724-748`)
  validates **host only** — protocol, port, apex/subdomain boundary — and never
  looks at the path. `SignIn` already passes `window.location.href`, so a
  `/checkout/...` URL round-trips through Google fine under ADR 0025.
- **`convex/` needs no change, and `git diff convex/` must come out empty.**
  `market.startCheckout` and `eft.startEftPurchase` both take `{topicSlug, lang}`
  — both in the route params.
- **The PayFast return is already correct.** `return_url` is minted server-side
  (`convex/market.ts:432`) to `/courses/<slug>?purchase=return&mp=`, so a card
  buyer never re-enters checkout; they land on the course with `CourseShell`'s
  reactive `ConfirmingBanner`. That is step 4. `cancel_url` drops an abandoning
  buyer on the bare course index — an accepted wart, named in 12's answer, not a
  bug to fix here (fixing it means touching `convex/`).
- **Resume works for free.** `eft.myEftIntent` on mount re-shows a pending
  buyer's reference, exactly as the dialog does today.

## Traps

- **The EFT-rail-off branch must survive the move.** `eftDetails` returns null
  when the rail is off or unconfigured, and that branch — the `bankGuidance` note
  plus one card button — is what every non-YWAM tenant sees. The rail is *on* in
  dev and prod today, so it is the branch you won't see unless you look.
- **The rail must stay empty of everything but the four one-word steps.** Read the
  comment above `CheckoutSteps` before adding anything: the labels plus markers
  measure ~275px, and French and Hindi are longer. It fits a phone only because it
  carries nothing else. Summary and price go in the body.
- **`lang` explicit always, `en` included.** An implicit language is the prod
  checkout bug — `resolveEdition` serves a free published translation instead of
  the paid Edition's paygate. See `editionUrl.ts`'s header note.
- **Never touch the PayFast code path.** It holds real money; five real purchases
  have completed through it.
- New strings through **all five** `messages/*.json` locales as `Checkout.*` keys.
- `tdd` then `ponytail`. Fixtures only for states a real mutation can produce —
  name the mutation first.
- Commit with `git commit --only <paths>` after `git diff` of those paths. The user
  runs concurrent sessions on `main`. Never `git add -A`, never `--amend`. Push
  only when asked — pushing `main` deploys prod.
- Two pre-existing test failures are **not yours**: the `convex/sales.test.ts`
  flake, and `scripts/bundle-authoring-assets.test.ts` (stale since `d5f3dc2`).

## Also on the frontier

Ticket 14 (phone-first pass on `SignIn` + the locked `Paygate` card) is unblocked
and independent — a separate session can take it now. Note **11 and 13 land in the
same surface**; whichever ships second inherits the merge.
