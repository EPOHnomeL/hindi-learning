import { describe, expect, it } from "vitest";
import { claimChunkReload, isChunkLoadError, type ReloadStore } from "./chunk-error";

// A sessionStorage stand-in: the test runs in the edge runtime, which has no
// window and no Storage.
function store(initial: Record<string, string> = {}): ReloadStore & { seen: Record<string, string> } {
  const seen = { ...initial };
  return {
    seen,
    getItem: (k) => seen[k] ?? null,
    setItem: (k, v) => {
      seen[k] = v;
    },
  };
}

// Webpack's loader throws this shape; the message wording is Next's.
function chunkLoadError(): Error {
  const error = new Error("Loading chunk app/layout-4f2a failed. (error: /_next/static/chunks/4f2a.js)");
  error.name = "ChunkLoadError";
  return error;
}

describe("isChunkLoadError", () => {
  it("recognises the webpack loader's ChunkLoadError", () => {
    expect(isChunkLoadError(chunkLoadError())).toBe(true);
  });

  it("recognises a chunk failure by message when the name is generic", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk 812 failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("leaves every other error alone, so a real bug still reaches the human", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError("ChunkLoadError")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("claimChunkReload", () => {
  it("claims the first chunk failure in the tab", () => {
    const s = store();
    expect(claimChunkReload(chunkLoadError(), s)).toBe(true);
    expect(s.seen["chunk-reload-attempted"]).toBe("1");
  });

  it("refuses the second, so a still-missing chunk cannot loop", () => {
    const s = store();
    expect(claimChunkReload(chunkLoadError(), s)).toBe(true);
    expect(claimChunkReload(chunkLoadError(), s)).toBe(false);
  });

  it("refuses anything that is not a chunk failure, and records nothing", () => {
    const s = store();
    expect(claimChunkReload(new Error("boom"), s)).toBe(false);
    expect(s.seen["chunk-reload-attempted"]).toBeUndefined();
  });

  it("refuses when sessionStorage is unreachable, since the guard would be gone", () => {
    expect(claimChunkReload(chunkLoadError(), null)).toBe(false);
  });
});
