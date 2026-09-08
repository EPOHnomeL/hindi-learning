import { beforeEach, describe, expect, it, vi } from "vitest";

// `shareEditionLocale` reaches Convex, so the query is stubbed: what's under test
// is the *policy* (offered → adopt, unoffered/unknown → null, error → null), not
// the round trip. `publicEditionLang` itself is covered in convex/public.test.ts.
const fetchQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/nextjs", () => ({ fetchQuery }));

const {
  courseEditionLocale,
  courseSlugFromPath,
  editionHint,
  editionHintLocale,
  editionHintScope,
  readShareLocaleMemo,
  shareEditionLocale,
  shareLocaleMemo,
  shareTokenFromPath,
} = await import("./shareLocale");

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

// ---- The course-URL entrance (2026-09-08) --------------------------------

describe("courseSlugFromPath", () => {
  it("reads the slug off the public course reader's URLs", () => {
    expect(courseSlugFromPath("/courses/hindi")).toBe("hindi");
    expect(courseSlugFromPath("/courses/hindi/lessons/0001-a")).toBe("hindi");
    expect(courseSlugFromPath("/courses/hindi/references/grammar")).toBe("hindi");
  });

  it("is null for the owner console and every non-reader path", () => {
    expect(courseSlugFromPath("/courses/hindi/manage")).toBeNull();
    expect(courseSlugFromPath("/courses")).toBeNull();
    expect(courseSlugFromPath("/share/abc123")).toBeNull();
    expect(courseSlugFromPath("/settings")).toBeNull();
  });
});

describe("courseEditionLocale", () => {
  beforeEach(() => {
    fetchQuery.mockReset();
  });

  it("adopts the Edition the slug entrance serves", async () => {
    fetchQuery.mockResolvedValue("hi");
    await expect(courseEditionLocale("hindi", null)).resolves.toBe("hi");
  });

  it("passes an explicit ?lang through, and omits it when there is none", async () => {
    fetchQuery.mockResolvedValue("es");
    await courseEditionLocale("hindi", "es");
    expect(fetchQuery).toHaveBeenLastCalledWith(expect.anything(), { slug: "hindi", lang: "es" });
    await courseEditionLocale("hindi", null);
    expect(fetchQuery).toHaveBeenLastCalledWith(expect.anything(), { slug: "hindi" });
  });

  it("declines a course with no public slug entrance, and a code we ship no chrome for", async () => {
    fetchQuery.mockResolvedValue(null);
    await expect(courseEditionLocale("private", null)).resolves.toBeNull();
    fetchQuery.mockResolvedValue("te");
    await expect(courseEditionLocale("hindi", null)).resolves.toBeNull();
  });

  it("swallows a backend failure, like its share twin", async () => {
    fetchQuery.mockImplementation(async () => {
      throw new Error("convex down");
    });
    await expect(courseEditionLocale("hindi", null)).resolves.toBeNull();
  });
});

// The asymmetry is the whole point: a share link overrides a stored locale on
// every request, a course URL only ever speaks on a device that has no locale
// yet, because a signed-in reader with a picker reads at that same URL.
describe("editionHint", () => {
  it("hints from a share link whether or not a locale is stored", () => {
    expect(editionHint("/share/abc/lessons/0001", null, false)).toEqual({ kind: "share", token: "abc" });
    expect(editionHint("/share/abc/lessons/0001", null, true)).toEqual({ kind: "share", token: "abc" });
  });

  it("hints from a course URL only on a first touch, carrying the requested Edition", () => {
    expect(editionHint("/courses/hindi", "es", false)).toEqual({ kind: "course", slug: "hindi", lang: "es" });
    expect(editionHint("/courses/hindi", "es", true)).toBeNull();
  });

  it("has nothing to say about any other path", () => {
    expect(editionHint("/settings", null, false)).toBeNull();
    expect(editionHint("/courses/hindi/manage", null, false)).toBeNull();
  });
});

describe("editionHintScope", () => {
  it("keys a share hint by its token and a course hint by slug and language", () => {
    expect(editionHintScope({ kind: "share", token: "abc" })).toBe("abc");
    expect(editionHintScope({ kind: "course", slug: "hindi", lang: "es" })).toBe("course:hindi:es");
    expect(editionHintScope({ kind: "course", slug: "hindi", lang: null })).toBe("course:hindi:");
  });

  it("round-trips through the memo, so turning pages costs no Convex read", () => {
    const scope = editionHintScope({ kind: "course", slug: "hindi", lang: "es" });
    expect(readShareLocaleMemo(shareLocaleMemo(scope, "es"), scope)).toBe("es");
    // A different Edition of the same course is a miss, not a stale hit.
    expect(readShareLocaleMemo(shareLocaleMemo(scope, "es"), "course:hindi:")).toBeNull();
  });
});

describe("editionHintLocale", () => {
  beforeEach(() => {
    fetchQuery.mockReset();
  });

  it("asks the right query for each entrance", async () => {
    fetchQuery.mockResolvedValue("hi");
    await expect(editionHintLocale({ kind: "share", token: "abc" })).resolves.toBe("hi");
    expect(fetchQuery).toHaveBeenLastCalledWith(expect.anything(), { token: "abc" });
    await expect(editionHintLocale({ kind: "course", slug: "hindi", lang: null })).resolves.toBe("hi");
    expect(fetchQuery).toHaveBeenLastCalledWith(expect.anything(), { slug: "hindi" });
  });
});
