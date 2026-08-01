import { describe, expect, it } from "vitest";
import { checkoutStep } from "./checkoutDerive";

// The checkout page's position on the four-step rail (Account → Method → Pay →
// Course). The distinction the rail has to get right is chosen-a-method vs
// started-paying: advancing on the click would show "Pay" while the buyer is
// still looking at two options, and never advancing would leave them on "Method"
// while staring at bank details.
describe("checkoutStep", () => {
  const buying = { entitled: false, onEftInstructions: false, redirectingToCard: false };

  it("is the method step before either rail is started", () => {
    expect(checkoutStep(buying)).toBe(2);
  });

  it("is the pay step on the bank-transfer instructions", () => {
    expect(checkoutStep({ ...buying, onEftInstructions: true })).toBe(3);
  });

  it("is the pay step while handing the buyer to the card gateway", () => {
    expect(checkoutStep({ ...buying, redirectingToCard: true })).toBe(3);
  });

  // A returning buyer with a pending EFT intent lands straight on the
  // instructions, so the rail must open at "Pay" without them clicking anything
  // this visit — the pending intent alone is enough.
  it("is the pay step for a returning buyer whose intent is already pending", () => {
    expect(checkoutStep({ ...buying, onEftInstructions: true, redirectingToCard: true })).toBe(3);
  });

  // Only reachable now that checkout is a page: the EFT buyer who leaves the tab
  // open until the operator confirms watches `courseHeader` flip off `preview`
  // under them. The dialog could never show step 4 — it was a screen you left.
  it("is the course step once the buyer holds the Edition", () => {
    expect(checkoutStep({ ...buying, entitled: true })).toBe(4);
  });

  it("holding the Edition wins over any in-flight payment state", () => {
    // Both rails can leave their state behind: an EFT intent stays pending in the
    // component after the confirmation grants access, and a card buyer who comes
    // back to the tab still has `redirectingToCard` set.
    expect(checkoutStep({ entitled: true, onEftInstructions: true, redirectingToCard: true })).toBe(4);
  });
});
