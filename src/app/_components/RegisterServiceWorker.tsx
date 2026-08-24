"use client";

import { useEffect } from "react";

// Registers the app-shell service worker (installable-app ticket 02). After the
// window load event, so registration never competes with first paint. Each
// tenant subdomain is its own origin, so each registers its own worker with its
// own caches; no cross-tenant sharing is possible.
//
// Production only: dev chunks under /_next/static/ are NOT content-hashed, so
// the worker's cache-first rule would serve stale HMR chunks and wreck the dev
// loop. NODE_ENV is inlined at build, so the dev bundle contains no registration
// at all.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js");
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
