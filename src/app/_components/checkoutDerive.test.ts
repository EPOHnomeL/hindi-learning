import { describe, expect, it } from "vitest";
import { checkoutStep } from "./checkoutDerive";

// The pay dialog's position on the four-step rail (Create account → Choose
// payment method → Pay → Continue). The distinction the rail has to get right is
// chosen-a-method vs started-paying: advancing on the click would show "Pay"
// while the buyer is still looking at two options, and never advancing would
// leave them on "Choose payment method" while staring at bank details.
describe("checkoutStep", () => {
  it("is the method step before either rail is started", () => {
    expect(checkoutStep({ onEftInstructions: false, redirectingToCard: false })).toBe(2);
  });

  it("is the pay step on the bank-transfer instructions", () => {
    expect(checkoutStep({ onEftInstructions: true, redirectingToCard: false })).toBe(3);
  });

  it("is the pay step while handing the buyer to the card gateway", () => {
    expect(checkoutStep({ onEftInstructions: false, redirectingToCard: true })).toBe(3);
  });

  // A returning buyer with a pending EFT intent lands straight on the
  // instructions, so the rail must open at "Pay" without them clicking anything
  // this visit — the pending intent alone is enough.
  it("is the pay step for a returning buyer whose intent is already pending", () => {
    expect(checkoutStep({ onEftInstructions: true, redirectingToCard: true })).toBe(3);
  });
});
