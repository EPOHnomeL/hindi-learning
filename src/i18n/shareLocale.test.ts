import { beforeEach, describe, expect, it, vi } from "vitest";

// `shareEditionLocale` reaches Convex, so the query is stubbed: what's under test
// is the *policy* (offered → adopt, unoffered/unknown → null, error → null), not
// the round trip. `publicEditionLang` itself is covered in convex/public.test.ts.
const fetchQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/nextjs", () => ({ fetchQuery }));

const { readShareLocaleMemo, shareEditionLocale, shareLocaleMemo, shareTokenFromPath } =
  await import("./shareLocale");

describe("shareTokenFromPath", () => {
  it("reads the token off the Guest reader's URLs", () => {
    expect(shareTokenFromPath("/share/abc123")).toBe("abc123");
    expect(shareTokenFromPath("/share/abc123/lessons/0001-a")).toBe("abc123");
    expect(shareTokenFromPath("/share/abc123/references/grammar")).toBe("abc123");
  });

  it("is null for every non-Guest path", () => {
    expect(shareTokenFromPath("/")).toBeNull();
    expect(shareTokenFromPath("/share")).toBeNull();
    expect(shareTokenFromPath("/share/")).toBeNull();
    expect(shareTokenFromPath("/courses/hindi/lessons/0001-a")).toBeNull();
    // Not a prefix match: only the first segment counts.
    expect(shareTokenFromPath("/courses/share/abc123")).toBeNull();
  });

  it("decodes a percent-encoded token", () => {
    expect(shareTokenFromPath("/share/a%2Fb")).toBe("a/b");
  });
});

describe("shareEditionLocale", () => {
  // Braces, not a concise arrow body: `mockReset()` returns the mock, and Vitest
  // treats a function returned from a hook as a teardown callback — it would call
  // the mock after every test (and re-throw from the error case below).
  beforeEach(() => {
    fetchQuery.mockReset();
  });

  it("adopts the Edition's language when the app ships that chrome locale", async () => {
    fetchQuery.mockResolvedValue("hi");
    await expect(shareEditionLocale("tok")).resolves.toBe("hi");
  });

  it("declines a language with no message file, so the caller can sniff instead", async () => {
    // Telugu: an offered *content* language, not an offered chrome locale.
    fetchQuery.mockResolvedValue("te");
    await expect(shareEditionLocale("tok")).resolves.toBeNull();
    // Romanized Hindi is deliberately not Devanagari chrome.
    fetchQuery.mockResolvedValue("hi-Latn");
    await expect(shareEditionLocale("tok")).resolves.toBeNull();
  });

  it("declines an unknown/revoked token", async () => {
    fetchQuery.mockResolvedValue(null);
    await expect(shareEditionLocale("nope")).resolves.toBeNull();
  });

  it("swallows a backend failure — the chrome language can't fail the page", async () => {
    // Thrown from the implementation, not mockRejectedValue: the latter builds the
    // rejected promise at setup time, which Vitest flags as unhandled.
    fetchQuery.mockImplementation(async () => {
      throw new Error("convex down");
    });
    await expect(shareEditionLocale("tok")).resolves.toBeNull();
  });
});

// The memo is what keeps the 2026-09-03 per-request override from re-reading
// `publicEditionLang` on every page a Guest turns. It is a cache, so every doubt
// about it (wrong token, junk value, a code we dropped chrome for) has to read as
// a miss and send the caller back to Convex.
describe("share locale memo", () => {
  it("round-trips a token and its locale", () => {
    expect(readShareLocaleMemo(shareLocaleMemo("tok123", "hi"), "tok123")).toBe("hi");
  });

  it("misses for a different token, so a regenerated link is re-read", () => {
    expect(readShareLocaleMemo(shareLocaleMemo("tok123", "hi"), "tok999")).toBeNull();
  });

  it("misses on an absent or malformed memo", () => {
    expect(readShareLocaleMemo(undefined, "tok")).toBeNull();
    expect(readShareLocaleMemo("", "tok")).toBeNull();
    expect(readShareLocaleMemo("tok", "tok")).toBeNull();
  });

  it("misses when the memoed code is not an offered chrome locale", () => {
    // A device that memoised Telugu before the offer-set changed under it.
    expect(readShareLocaleMemo("tok:te", "tok")).toBeNull();
  });

  it("survives a token with cookie-hostile characters", () => {
    const memo = shareLocaleMemo("a/b:c", "fr");
    expect(memo).not.toContain("/");
    expect(readShareLocaleMemo(memo, "a/b:c")).toBe("fr");
  });
});
