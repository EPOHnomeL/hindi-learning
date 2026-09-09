import { describe, expect, it } from "vitest";
import { cachedCourseCount, catalogueCacheKey, DASHBOARD_CACHE_KEY, readCache, writeCache } from "./offlineCache";

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

describe("the Offline Catalogue cache", () => {
  it("round-trips a value", () => {
    const s = fakeStorage();
    writeCache(s, DASHBOARD_CACHE_KEY, [{ slug: "hindi-1", title: "Hindi 1" }]);
    expect(readCache(s, DASHBOARD_CACHE_KEY)).toEqual([{ slug: "hindi-1", title: "Hindi 1" }]);
  });

  it("reads null when nothing was cached (first-ever offline visit)", () => {
    expect(readCache(fakeStorage(), DASHBOARD_CACHE_KEY)).toBeNull();
  });

  it("reads corrupt JSON as null rather than throwing", () => {
    const s = fakeStorage({ [DASHBOARD_CACHE_KEY]: "{not json" });
    expect(readCache(s, DASHBOARD_CACHE_KEY)).toBeNull();
  });

  it("keys the catalogue per tenant, the dashboard per browser", () => {
    expect(catalogueCacheKey("ywampotch")).toBe("hindi:cache:catalogue:ywampotch");
    expect(catalogueCacheKey(null)).toBe("hindi:cache:catalogue:default");
    expect(DASHBOARD_CACHE_KEY).toBe("hindi:cache:dashboard");
  });
});

describe("cachedCourseCount", () => {
  it("counts the last-known-good list", () => {
    const s = fakeStorage();
    writeCache(s, DASHBOARD_CACHE_KEY, [{ slug: "a" }, { slug: "b" }]);
    expect(cachedCourseCount(s)).toBe(2);
  });

  it("caps a long list, so a big library does not paint a screenful of placeholders", () => {
    const s = fakeStorage();
    writeCache(s, DASHBOARD_CACHE_KEY, Array.from({ length: 40 }, (_, i) => ({ slug: String(i) })));
    expect(cachedCourseCount(s)).toBe(6);
  });

  it("reads a first-ever visit as null, so the caller keeps its default", () => {
    expect(cachedCourseCount(fakeStorage())).toBeNull();
  });

  // The sign-out sweep clears this key, so the next account starts from the
  // default rather than inheriting the previous one's shape.
  it("reads an empty cached list as null", () => {
    const s = fakeStorage();
    writeCache(s, DASHBOARD_CACHE_KEY, []);
    expect(cachedCourseCount(s)).toBeNull();
  });

  it("reads corrupt JSON as null rather than throwing", () => {
    expect(cachedCourseCount(fakeStorage({ [DASHBOARD_CACHE_KEY]: "{not json" }))).toBeNull();
  });

  it("reads a non-array as null", () => {
    expect(cachedCourseCount(fakeStorage({ [DASHBOARD_CACHE_KEY]: '"nope"' }))).toBeNull();
  });
});
