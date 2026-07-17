import { describe, expect, it } from "vitest";
import { clearAccountLocalState } from "./accountLocalState";

// A minimal in-memory Storage stand-in — the helper only touches
// length/key/removeItem, but a full setItem/getItem keeps the test readable.
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

describe("clearAccountLocalState", () => {
  it("drops per-account reader state so the next account can't inherit it", () => {
    const storage = fakeStorage({
      "hindi:lang": "xh",
      "hindi:answers-seen": "[\"a\",\"b\"]",
      "hindi:cert-celebrated:prophetic-school": "1",
      "hindi:guest-done:tok": "[]",
    });

    clearAccountLocalState(storage);

    expect(storage.getItem("hindi:lang")).toBeNull();
    expect(storage.getItem("hindi:answers-seen")).toBeNull();
    expect(storage.getItem("hindi:cert-celebrated:prophetic-school")).toBeNull();
    expect(storage.getItem("hindi:guest-done:tok")).toBeNull();
  });

  it("keeps the theme — it's a deliberate device preference, not per-account", () => {
    const storage = fakeStorage({ "hindi:theme": "dark", "hindi:lang": "xh" });

    clearAccountLocalState(storage);

    expect(storage.getItem("hindi:theme")).toBe("dark");
    expect(storage.getItem("hindi:lang")).toBeNull();
  });

  it("leaves other apps' keys untouched", () => {
    const storage = fakeStorage({ "other:thing": "keep", "hindi:lang": "xh" });

    clearAccountLocalState(storage);

    expect(storage.getItem("other:thing")).toBe("keep");
    expect(storage.getItem("hindi:lang")).toBeNull();
  });
});
