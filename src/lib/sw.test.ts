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

// Evaluate public/sw.js in a fresh vm and hand back its captured handlers, so a
// test can stub `caches` per case. `caches` defaults to {}, which is enough for
// the routing tests since they never touch it.
function loadWorker(caches: unknown = {}) {
  const src = readFileSync("public/sw.js", "utf8");
  const captured: Record<string, unknown> = {};
  let skipWaiting = 0;
  const self: Record<string, unknown> = {
    addEventListener: (type: string, fn: unknown) => {
      captured[type] = fn;
    },
    location: { origin: "https://ywampotch.my-course.app" },
    skipWaiting: () => {
      skipWaiting += 1;
    },
    clients: { claim: () => undefined },
  };
  const ctx = createContext({ self, location: self.location, caches, fetch: () => undefined, URL });
  runInContext(src, ctx);
  return { self, listeners: captured, skipWaitingCount: () => skipWaiting };
}

// Fire the captured install handler and return whatever it passed to waitUntil,
// so a test can assert the install promise settles rather than rejecting.
function install(handlers: Record<string, unknown>): Promise<unknown> {
  let waited: Promise<unknown> = Promise.resolve();
  (handlers.install as (e: { waitUntil: (p: Promise<unknown>) => void }) => void)({
    waitUntil: (p) => {
      waited = p;
    },
  });
  return waited;
}

beforeAll(() => {
  const loaded = loadWorker();
  listeners = loaded.listeners;
  route = (loaded.self as { __route?: typeof route }).__route!;
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

// A failed offline shell must not fail the install. Before this was guarded, a
// rejected cache.add("/") rejected waitUntil, the install failed, and the
// register() call in RegisterServiceWorker reported it as an unhandled
// "Error: Rejected" (PostHog report 01a06afd).
describe("install tolerates a shell that will not cache", () => {
  it("caches / and activates on the happy path", async () => {
    const added: string[] = [];
    const worker = loadWorker({
      open: () => Promise.resolve({ add: (req: string) => (added.push(req), Promise.resolve()) }),
    });
    await expect(install(worker.listeners)).resolves.toBeUndefined();
    expect(added).toEqual(["/"]);
    expect(worker.skipWaitingCount()).toBe(1);
  });

  it("still activates when cache.add rejects (non-2xx or dropped network)", async () => {
    const worker = loadWorker({
      open: () => Promise.resolve({ add: () => Promise.reject(new Error("Request failed")) }),
    });
    await expect(install(worker.listeners)).resolves.toBeUndefined();
    expect(worker.skipWaitingCount()).toBe(1);
  });

  it("still activates when caches.open rejects (storage denied)", async () => {
    const worker = loadWorker({ open: () => Promise.reject(new Error("SecurityError")) });
    await expect(install(worker.listeners)).resolves.toBeUndefined();
    expect(worker.skipWaitingCount()).toBe(1);
  });
});
