import { describe, expect, it } from "vitest";
import { installDismissed } from "./installPromptDerive";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_756_000_000_000;

describe("installDismissed", () => {
  it("is not dismissed when the key has never been written", () => {
    expect(installDismissed(null, NOW)).toBe(false);
  });

  it("is dismissed for 30 days after Not now", () => {
    expect(installDismissed(String(NOW - 1 * DAY), NOW)).toBe(true);
    expect(installDismissed(String(NOW - 29 * DAY), NOW)).toBe(true);
  });

  it("expires after 30 days", () => {
    expect(installDismissed(String(NOW - 30 * DAY), NOW)).toBe(false);
    expect(installDismissed(String(NOW - 400 * DAY), NOW)).toBe(false);
  });

  it("treats a corrupt value as never dismissed", () => {
    expect(installDismissed("not-a-number", NOW)).toBe(false);
    expect(installDismissed("", NOW)).toBe(false);
    expect(installDismissed("-5", NOW)).toBe(false);
  });
});
