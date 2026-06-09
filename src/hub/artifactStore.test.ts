import { describe, expect, it } from "vitest";
import { InMemoryArtifactStore } from "./artifactStore.js";

describe("InMemoryArtifactStore", () => {
  it("stores and returns an HTML blob by key", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("lessons/0001.html", "<h1>शान्ति</h1>");

    expect(await store.get("lessons/0001.html")).toBe("<h1>शान्ति</h1>");
  });

  it("returns undefined for a missing key", async () => {
    expect(await new InMemoryArtifactStore().get("nope")).toBeUndefined();
  });

  it("overwrites on re-put (current version wins)", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("k", "v1");
    await store.put("k", "v2");

    expect(await store.get("k")).toBe("v2");
  });
});
