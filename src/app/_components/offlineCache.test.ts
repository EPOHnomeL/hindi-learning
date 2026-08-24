import { describe, expect, it } from "vitest";
import { catalogueCacheKey, DASHBOARD_CACHE_KEY, readCache, writeCache } from "./offlineCache";

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
