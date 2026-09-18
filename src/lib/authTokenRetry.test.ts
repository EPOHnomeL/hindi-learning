import { describe, expect, test, vi } from "vitest";
import { retryingTokenFetcher } from "./authTokenRetry";

const args = { forceRefreshToken: true };
const noSleep = async () => undefined;

describe("retryingTokenFetcher", () => {
  test("a fetch that succeeds is passed straight through", async () => {
    const fetchToken = vi.fn(async () => "jwt");
    const onGiveUp = vi.fn();
    const fetcher = retryingTokenFetcher(fetchToken, { delaysMs: [1, 2], sleep: noSleep, onGiveUp });
    await expect(fetcher(args)).resolves.toBe("jwt");
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  test("a rejection is retried after each delay, and the first success wins", async () => {
    const fetchToken = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("jwt");
    const sleep = vi.fn(noSleep);
    const onGiveUp = vi.fn();
    const fetcher = retryingTokenFetcher(fetchToken, { delaysMs: [100, 200, 400], sleep, onGiveUp });
    await expect(fetcher(args)).resolves.toBe("jwt");
    expect(fetchToken).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  test("once every delay is spent it resolves null and reports, never rejects", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchToken = vi.fn(async () => {
      throw error;
    });
    const onGiveUp = vi.fn();
    const fetcher = retryingTokenFetcher(fetchToken, { delaysMs: [1, 2], sleep: noSleep, onGiveUp });
    await expect(fetcher(args)).resolves.toBeNull();
    expect(fetchToken).toHaveBeenCalledTimes(3);
    expect(onGiveUp).toHaveBeenCalledWith(error, 3);
  });

  test("a reporter that throws does not turn the give-up back into a rejection", async () => {
    const fetchToken = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const onGiveUp = vi.fn(() => {
      throw new Error("reporter down");
    });
    const fetcher = retryingTokenFetcher(fetchToken, { delaysMs: [], sleep: noSleep, onGiveUp });
    await expect(fetcher(args)).resolves.toBeNull();
  });

  test("the original arguments reach every attempt", async () => {
    const fetchToken = vi
      .fn<(a: { forceRefreshToken: boolean }) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce(null);
    const fetcher = retryingTokenFetcher(fetchToken, { delaysMs: [1], sleep: noSleep, onGiveUp: () => undefined });
    await fetcher({ forceRefreshToken: false });
    expect(fetchToken.mock.calls).toEqual([[{ forceRefreshToken: false }], [{ forceRefreshToken: false }]]);
  });
});
