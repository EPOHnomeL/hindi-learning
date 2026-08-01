// Pure derivations behind the checkout funnel's step rail (ywampotch-launch/09).
// Sits beside welcomeDerive/readerDerive for the same reason they exist: it is
// the rail's own seam, testable without React or a DOM.

// Create account → Choose payment method → Pay → Continue to <course>.
//
// Only the first three are ever *current*: the fourth is the destination,
// reached by leaving checkout entirely, so nothing in the funnel renders it as
// "here". Step 1 is not derived — AppGate renders SignIn only to unauthenticated
// visitors, so that screen is the account step by construction. What actually
// needs deciding is the pay dialog's own position, below.
export type CheckoutStep = 1 | 2 | 3;

// Where a signed-in buyer is inside the pay dialog.
//
// "Pay" begins when a method has been *started*, not merely chosen — the bank
// details are on screen, or the browser is being handed to the card gateway.
// Both of those are the buyer moving money; the chooser is not, which is why
// picking a method is not enough on its own to advance the rail.
export function checkoutStep({
  onEftInstructions,
  redirectingToCard,
}: {
  onEftInstructions: boolean;
  redirectingToCard: boolean;
}): Extract<CheckoutStep, 2 | 3> {
  return onEftInstructions || redirectingToCard ? 3 : 2;
}
