import { describe, expect, it } from "vitest";
import { appIconSpec, buildManifest, type PwaTenant } from "./pwa";

// A seeded tenant as getTenantView returns it (palette trimmed to the tokens
// the manifest reads; the real object carries all 14).
const ywam: PwaTenant = {
  displayName: "YWAM Potchefstroom",
  theme: { light: { paper: "#f4f6fb", accent: "#1b2a80" } },
  logoUrl: "https://storage.example/logo.png",
  faviconUrl: "https://storage.example/favicon.png",
};

describe("buildManifest", () => {
  it("names the tenant and paints its palette", () => {
    const m = buildManifest(ywam);
    expect(m.name).toBe("YWAM Potchefstroom");
    expect(m.short_name).toBe("YWAM Potchefstroom");
    expect(m.theme_color).toBe("#f4f6fb");
    expect(m.background_color).toBe("#f4f6fb");
  });

  it("is a standalone app rooted at /", () => {
    const m = buildManifest(ywam);
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.id).toBe("/");
  });

  it("lists 192, 512 and a maskable 512, all PNG", () => {
    const m = buildManifest(ywam);
    expect(m.icons).toEqual([
      { src: "/app-icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon?size=512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("gives the default site the shipped identity", () => {
    const m = buildManifest(null);
    expect(m.name).toBe("My Course");
    // The globals.css light palette (--color-paper).
    expect(m.theme_color).toBe("#fbf7f0");
    expect(m.background_color).toBe("#fbf7f0");
    expect(m.display).toBe("standalone");
  });
});

describe("appIconSpec", () => {
  it("puts the Logo on an opaque square of the tenant's paper", () => {
    const s = appIconSpec(ywam, { size: 512, maskable: false });
    expect(s).toEqual({
      size: 512,
      background: "#f4f6fb",
      src: "https://storage.example/logo.png",
      // object-contain box: padding keeps a 7:1 banner off the edges.
      box: 410,
    });
  });

  it("shrinks the box to ~60% for the maskable variant", () => {
    const s = appIconSpec(ywam, { size: 512, maskable: true });
    expect(s.box).toBe(307);
  });

  it("falls back Logo -> Favicon -> null (the shipped mark)", () => {
    expect(appIconSpec({ ...ywam, logoUrl: null }, { size: 192, maskable: false }).src).toBe(
      "https://storage.example/favicon.png",
    );
    expect(
      appIconSpec({ ...ywam, logoUrl: null, faviconUrl: null }, { size: 192, maskable: false }).src,
    ).toBeNull();
  });

  it("degrades an unseeded host to the default square", () => {
    const s = appIconSpec(null, { size: 180, maskable: false });
    expect(s.background).toBe("#fbf7f0");
    expect(s.src).toBeNull();
    expect(s.size).toBe(180);
  });
});
