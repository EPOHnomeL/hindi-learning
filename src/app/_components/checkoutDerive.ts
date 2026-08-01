// Pure derivations behind the checkout funnel's step rail (ywampotch-launch/09).
// Sits beside welcomeDerive/readerDerive for the same reason they exist: it is
// the rail's own seam, testable without React or a DOM.

// Account → Method → Pay → Course.
//
// Step 1 is not derived — AppGate renders SignIn only to unauthenticated
// visitors, so that screen is the account step by construction. What actually
// needs deciding is the checkout page's own position, below.
export type CheckoutStep = 1 | 2 | 3 | 4;

// Where a signed-in buyer is on the checkout page.
//
// "Pay" begins when a method has been *started*, not merely chosen — the bank
// details are on screen, or the browser is being handed to the card gateway.
// Both of those are the buyer moving money; the chooser is not, which is why
// picking a method is not enough on its own to advance the rail.
//
// "Course" means the Edition is held: `courseHeader` no longer reports the
// caller as `preview`. It is a live step only because checkout is a page now —
// an EFT buyer can sit on this URL while the operator confirms the transfer and
// watch it tick over. It wins over both payment states, because either can be
// left behind by the grant that ends them.
export function checkoutStep({
  entitled,
  onEftInstructions,
  redirectingToCard,
}: {
  entitled: boolean;
  onEftInstructions: boolean;
  redirectingToCard: boolean;
}): Exclude<CheckoutStep, 1> {
  if (entitled) return 4;
  return onEftInstructions || redirectingToCard ? 3 : 2;
}
