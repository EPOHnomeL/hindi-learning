import { describe, expect, it } from "vitest";
import type { CaptureResult } from "posthog-js";
import { dropFramelessNetworkRejection } from "./posthogBeforeSend";

// Build a CaptureResult with the given $exception_list, as posthog-js hands one
// to before_send.
function exceptionEvent(list: unknown[]): CaptureResult {
  return {
    uuid: "0192-test",
    event: "$exception",
    properties: { $exception_list: list },
  };
}

// The observed frameless rejection: unhandled, synthetic, no stacktrace key.
const framelessRejection = {
  type: "Error",
  value: "Network request failed",
  mechanism: { handled: false, synthetic: true },
};

describe("dropFramelessNetworkRejection", () => {
  it("drops an unhandled synthetic rejection with no frames", () => {
    expect(dropFramelessNetworkRejection(exceptionEvent([framelessRejection]))).toBeNull();
  });

  it("keeps an exception that carries stack frames", () => {
    const withStack = exceptionEvent([
      {
        type: "TypeError",
        value: "x is not a function",
        mechanism: { handled: false, synthetic: false },
        stacktrace: { type: "raw", frames: [{ function: "lesson", lineno: 4 }] },
      },
    ]);
    expect(dropFramelessNetworkRejection(withStack)).toBe(withStack);
  });

  it("keeps a handled exception even when it has no frames", () => {
    const handled = exceptionEvent([
      { type: "Error", value: "caught", mechanism: { handled: true, synthetic: true } },
    ]);
    expect(dropFramelessNetworkRejection(handled)).toBe(handled);
  });

  it("keeps a non-synthetic frameless rejection", () => {
    const real = exceptionEvent([
      { type: "Error", value: "boom", mechanism: { handled: false, synthetic: false } },
    ]);
    expect(dropFramelessNetworkRejection(real)).toBe(real);
  });

  it("keeps the event when any entry carries frames", () => {
    const mixed = exceptionEvent([
      framelessRejection,
      {
        type: "Error",
        value: "real",
        mechanism: { handled: false, synthetic: true },
        stacktrace: { type: "raw", frames: [{ function: "run" }] },
      },
    ]);
    expect(dropFramelessNetworkRejection(mixed)).toBe(mixed);
  });

  it("passes through non-exception events", () => {
    const pageview: CaptureResult = {
      uuid: "0192-pv",
      event: "$pageview",
      properties: { $current_url: "https://ywampotch.my-course.app/lesson/1" },
    };
    expect(dropFramelessNetworkRejection(pageview)).toBe(pageview);
  });

  it("passes through an exception with an empty list", () => {
    const empty = exceptionEvent([]);
    expect(dropFramelessNetworkRejection(empty)).toBe(empty);
  });

  it("passes through null", () => {
    expect(dropFramelessNetworkRejection(null)).toBeNull();
  });
});
