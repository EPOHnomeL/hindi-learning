import { describe, expect, it } from "vitest";
import { DONATION_PRESETS_USD_CENTS, donationAmount, formatUsd, parseUsdCents } from "./donateDerive";

// The floor the widget is served by `donations.config`; hard-coded here so a
// change to the committed constant shows up as a *deliberate* test edit.
const MIN = 500;
const base = { minUsdCents: MIN };

describe("parseUsdCents", () => {
  it("reads whole dollars and cents as integer cents", () => {
    expect(parseUsdCents("20")).toBe(2000);
    expect(parseUsdCents("20.5")).toBe(2050);
    expect(parseUsdCents("20.50")).toBe(2050);
    expect(parseUsdCents("0.05")).toBe(5);
  });

  // What a donor actually types into a money field: a leading $, a thousands
  // comma, stray spaces. All meant the amount they meant.
  it("forgives the decoration around the number", () => {
    expect(parseUsdCents(" $1,250.00 ")).toBe(125000);
  });

  // No parseFloat at the money boundary: anything that isn't a plain amount is
  // rejected outright rather than coerced into a charge nobody chose.
  it("rejects anything that is not a plain dollar amount", () => {
    for (const bad of ["", "   ", "abc", "1e3", "-5", "5.", ".5", "5.123", "5,5", "1 2", "Infinity", "NaN"]) {
      expect(parseUsdCents(bad), bad).toBeNull();
    }
  });
});

describe("donationAmount", () => {
  it("takes a preset chip at face value", () => {
    expect(donationAmount({ selection: 2500, custom: "", ...base })).toEqual({ ok: true, usdCents: 2500 });
  });

  it("takes the custom field to the cent", () => {
    expect(donationAmount({ selection: "custom", custom: "7.77", ...base })).toEqual({ ok: true, usdCents: 777 });
  });

  it("holds an empty custom field open rather than calling it invalid", () => {
    expect(donationAmount({ selection: "custom", custom: "  ", ...base })).toEqual({ ok: false, reason: "empty" });
  });

  it("names an unparseable amount as invalid", () => {
    expect(donationAmount({ selection: "custom", custom: "twenty", ...base })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  // The floor is enforced here AND server-side (`checkoutFields` throws). This
  // copy of it exists so the donor is told before the click, not after it.
  it("refuses below the floor and accepts the floor itself", () => {
    expect(donationAmount({ selection: "custom", custom: "4.99", ...base })).toEqual({
      ok: false,
      reason: "below-min",
    });
    expect(donationAmount({ selection: "custom", custom: "5", ...base })).toMatchObject({ ok: true, usdCents: 500 });
  });

  it("keeps every preset above the floor", () => {
    for (const cents of DONATION_PRESETS_USD_CENTS) {
      expect(donationAmount({ selection: cents, custom: "", ...base }), String(cents)).toMatchObject({ ok: true });
    }
  });
});

describe("formatting", () => {
  it("writes dollars without trailing zero cents", () => {
    expect(formatUsd(2500)).toBe("$25");
    expect(formatUsd(2050)).toBe("$20.50");
    expect(formatUsd(500)).toBe("$5");
  });
});
