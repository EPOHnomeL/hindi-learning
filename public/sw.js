// @ts-nocheck -- classic service-worker script; the DOM lib has no SW globals.
// The app-shell service worker (installable-app ticket 02, ADR 0030 §3).
// Hand-rolled, not next-pwa/Serwist: three rules, and the rules are the design.
//
//   1. /_next/static/*  -> cache-first, indefinitely. Safe precisely because the
//      names are content-hashed: a changed file is a changed name.
//   2. navigations      -> network-first, falling back to the cached "/". This is
//      the deploy-safety mechanism, not a preference: online always gets fresh
//      HTML, so a deploy can never serve a stale document referencing deleted
//      chunks (the classic PWA white screen). The cached "/" is reached only
//      when the network genuinely fails.
//   3. everything else  -> network only. Explicitly including App Router ?_rsc=
//      payloads (caching those makes client navigation go stale in miserable
//      ways) and every Convex call.
//
// Bump VERSION on any change to this file: activate purges caches under other
// versions, and skipWaiting/clients.claim make a deploy take effect on the next
// launch rather than the one after.
const VERSION = "v1";
const STATIC_CACHE = "static-" + VERSION;
const SHELL_CACHE = "shell-" + VERSION;

// The pure routing decision behind the fetch handler: "static" (rule 1),
// "navigation" (rule 2) or "network" (rule 3). Exposed as self.__route so
// src/lib/sw.test.ts can pin the rules without a service-worker harness.
function route(url, mode) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return "network";
  // Belt and braces: _rsc should never arrive with mode "navigate", but if it
  // does, serving the shell for it would be the stale-navigation bug rule 3 exists
  // to prevent.
  if (u.searchParams.has("_rsc")) return "network";
  if (u.pathname.startsWith("/_next/static/")) return "static";
  if (mode === "navigate") return "navigation";
  return "network";
}
self.__route = route;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const kind = route(event.request.url, event.request.mode);
  if (kind === "static") {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const res = await fetch(event.request);
          if (res.ok) await cache.put(event.request, res.clone());
          return res;
        } catch {
          // Network dropped on a cache miss. Resolve with a network-error
          // Response so respondWith never rejects: a rejected respondWith turns
          // a transient drop into an uncaught "TypeError: Failed to fetch". The
          // hashed chunk is simply unavailable until the network returns.
          return Response.error();
        }
      }),
    );
  } else if (kind === "navigation") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request);
          // Keep the fallback fresh: a successful "/" render replaces the one
          // cached at install, so the offline shell tracks the latest deploy
          // the device has actually seen.
          if (res.ok && new URL(event.request.url).pathname === "/") {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put("/", res.clone());
          }
          return res;
        } catch {
          const hit = await caches.match("/");
          if (hit) return hit;
          throw new Error("offline and no cached shell");
        }
      })(),
    );
  }
  // "network": no respondWith, the browser does its normal thing.
});
