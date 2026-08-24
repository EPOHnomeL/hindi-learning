import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";

// The service worker's three caching rules (installable-app ticket 02). The
// worker is a classic script with no module seam, so the test runs public/sw.js
// in a vm with stubbed worker globals and pins the pure routing decision it
// exposes as self.__route(url, mode).
type Route = "static" | "navigation" | "network";
let route: (url: string, mode: string) => Route;
let listeners: Record<string, unknown>;

beforeAll(() => {
  const src = readFileSync("public/sw.js", "utf8");
  const self: Record<string, unknown> = {
    addEventListener: (type: string, fn: unknown) => {
      listeners[type] = fn;
    },
    location: { origin: "https://ywampotch.my-course.app" },
    skipWaiting: () => undefined,
    clients: { claim: () => undefined },
  };
  listeners = {};
  const ctx = createContext({ self, location: self.location, caches: {}, fetch: () => undefined, URL });
  runInContext(src, ctx);
  route = (self as { __route?: typeof route }).__route!;
});

it("registers install, activate and fetch handlers", () => {
  expect(Object.keys(listeners).sort()).toEqual(["activate", "fetch", "install"]);
});

describe("the three rules", () => {
  const origin = "https://ywampotch.my-course.app";

  it("hashed static assets are cache-first", () => {
    expect(route(`${origin}/_next/static/chunks/abc123.js`, "no-cors")).toBe("static");
    expect(route(`${origin}/_next/static/css/def.css`, "no-cors")).toBe("static");
  });

  it("navigations are network-first with the cached / fallback", () => {
    expect(route(`${origin}/`, "navigate")).toBe("navigation");
    expect(route(`${origin}/course/hindi-1`, "navigate")).toBe("navigation");
  });

  it("?_rsc= payloads are network only, even though same-origin", () => {
    expect(route(`${origin}/course/hindi-1?_rsc=abc`, "cors")).toBe("network");
    // Belt and braces: even a navigate-mode request carrying _rsc is not served
    // from the shell cache.
    expect(route(`${origin}/?_rsc=abc`, "navigate")).toBe("network");
  });

  it("cross-origin (Convex) is network only", () => {
    expect(route("https://judicious-marmot-580.convex.cloud/api/sync", "cors")).toBe("network");
  });

  it("same-origin non-static non-navigation is network only", () => {
    expect(route(`${origin}/app-icon?size=192`, "no-cors")).toBe("network");
    expect(route(`${origin}/manifest.webmanifest`, "cors")).toBe("network");
  });
});
