import { describe, expect, it } from "vitest";
import { claimSkewReload, type ReloadStore } from "./deploy-skew";

// A stub sessionStorage, so the one-shot guard is tested without a browser.
function store(seed: Record<string, string> = {}): ReloadStore & { seen: Record<string, string> } {
  const seen = { ...seed };
  return {
    seen,
    getItem: (k) => seen[k] ?? null,
    setItem: (k, v) => {
      seen[k] = v;
    },
  };
}

describe("claimSkewReload", () => {
  it("claims the first reload and records it", () => {
    const s = store();
    expect(claimSkewReload(s)).toBe(true);
    expect(s.seen["tenant-skew-reload-attempted"]).toBe("1");
  });

  it("refuses the second reload in the same tab", () => {
    const s = store();
    expect(claimSkewReload(s)).toBe(true);
    expect(claimSkewReload(s)).toBe(false);
    expect(claimSkewReload(s)).toBe(false);
  });

  it("refuses a reload with no store, so a denied sessionStorage cannot loop", () => {
    expect(claimSkewReload(null)).toBe(false);
  });

  it("honours a flag left by an earlier reload of the same tab", () => {
    expect(claimSkewReload(store({ "tenant-skew-reload-attempted": "1" }))).toBe(false);
  });
});
