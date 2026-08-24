import { describe, expect, it } from "vitest";
import { appIconSpec, buildManifest, satoriImageType, type PwaTenant } from "./pwa";

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
  it("puts the Logo first on an opaque square of the tenant's paper", () => {
    const s = appIconSpec(ywam, { size: 512, maskable: false });
    expect(s).toEqual({
      size: 512,
      background: "#f4f6fb",
      // Candidates in fallback order; the route uses the first one satori can
      // actually decode (a webp logo must fall through to the favicon).
      sources: ["https://storage.example/logo.png", "https://storage.example/favicon.png"],
      // object-contain box: padding keeps a 7:1 banner off the edges.
      box: 410,
    });
  });

  it("shrinks the box to ~60% for the maskable variant", () => {
    const s = appIconSpec(ywam, { size: 512, maskable: true });
    expect(s.box).toBe(307);
  });

  it("drops missing sources: Logo -> Favicon -> nothing (the shipped mark)", () => {
    expect(appIconSpec({ ...ywam, logoUrl: null }, { size: 192, maskable: false }).sources).toEqual([
      "https://storage.example/favicon.png",
    ]);
    expect(
      appIconSpec({ ...ywam, logoUrl: null, faviconUrl: null }, { size: 192, maskable: false }).sources,
    ).toEqual([]);
  });

  it("degrades an unseeded host to the default square", () => {
    const s = appIconSpec(null, { size: 180, maskable: false });
    expect(s.background).toBe("#fbf7f0");
    expect(s.sources).toEqual([]);
    expect(s.size).toBe(180);
  });
});

describe("satoriImageType", () => {
  const bytes = (...b: (number | string)[]) =>
    Uint8Array.from(
      b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])),
    );

  it("recognises the formats satori can decode", () => {
    expect(satoriImageType(bytes(0x89, "PNG\r\n", 0x1a, 0x0a, 0, 0, 0, 0))).toBe("image/png");
    expect(satoriImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe("image/jpeg");
    expect(satoriImageType(bytes("GIF89a", 0, 0, 0, 0, 0, 0))).toBe("image/gif");
  });

  it("rejects webp, which satori renders as nothing (the YWAM blank-icon bug)", () => {
    expect(satoriImageType(bytes("RIFF", 0x10, 0, 0, 0, "WEBP"))).toBeNull();
  });

  it("rejects unknown or too-short bytes", () => {
    expect(satoriImageType(bytes("<svg", 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(satoriImageType(bytes(1, 2))).toBeNull();
  });
});
