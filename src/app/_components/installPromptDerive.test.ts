import { describe, expect, it } from "vitest";
import { chromeIntentUrl, installDismissed, isIosBrowser, isSamsungInternet } from "./installPromptDerive";

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

describe("isIosBrowser", () => {
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
  const IPADOS_AS_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36";
  const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

  it("recognises iPhone and iPad", () => {
    expect(isIosBrowser(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIosBrowser(IPAD, 5)).toBe(true);
  });

  it("includes iOS Chrome: every iOS browser is Safari underneath, same route", () => {
    expect(isIosBrowser(IPHONE_CHROME, 5)).toBe(true);
  });

  it("catches iPadOS masquerading as a Mac by its touch points", () => {
    expect(isIosBrowser(IPADOS_AS_MAC, 5)).toBe(true);
  });

  it("excludes a real Mac, Android, and Windows", () => {
    expect(isIosBrowser(IPADOS_AS_MAC, 0)).toBe(false);
    expect(isIosBrowser(ANDROID, 5)).toBe(false);
    expect(isIosBrowser(WINDOWS, 0)).toBe(false);
  });
});

describe("isSamsungInternet", () => {
  const SAMSUNG =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
  const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36";
  const ANDROID_EDGE =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 EdgA/125.0";

  it("recognises Samsung Internet", () => {
    expect(isSamsungInternet(SAMSUNG)).toBe(true);
  });

  it("does not sweep in the other Chromium browsers, whose WebAPK is fine", () => {
    expect(isSamsungInternet(ANDROID_CHROME)).toBe(false);
    expect(isSamsungInternet(ANDROID_EDGE)).toBe(false);
  });
});

describe("chromeIntentUrl", () => {
  it("reopens the exact page in Chrome", () => {
    expect(chromeIntentUrl("https://ywampotch.my-course.app/")).toBe(
      "intent://ywampotch.my-course.app/#Intent;scheme=https;package=com.android.chrome;" +
        "S.browser_fallback_url=https%3A%2F%2Fywampotch.my-course.app%2F;end",
    );
  });

  it("keeps the path and query, so the tenant lands where it left off", () => {
    expect(chromeIntentUrl("https://ywampotch.my-course.app/course/abc?ref=1")).toContain(
      "intent://ywampotch.my-course.app/course/abc?ref=1#Intent;",
    );
  });
});
