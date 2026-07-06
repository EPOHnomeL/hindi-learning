"use client";

import { useSyncExternalStore } from "react";

// Auto-hiding top nav (mobile only). Scrolling down slides the mobile header out
// of view for a fuller-screen read; scrolling up (or reaching the top) brings it
// back. A single window scroll listener drives one shared boolean, so the header
// and the secondary sticky bars below it — which all read this hook — move in
// lockstep with no prop plumbing between the shells and the panes.
//
// Only the mobile layout scrolls the window; desktop columns scroll internally,
// so `scrollY` stays 0 there and this always reports "visible" (the `md:` styles
// keep the nav in place regardless).

const REVEAL_AT = 48; // header height (h-12) — always show at/near the top
const DELTA = 6; // ignore sub-pixel jitter and rubber-band overscroll

let hidden = false;
let lastY = 0;
const listeners = new Set<() => void>();

function onScroll() {
  const y = window.scrollY;
  const next =
    y <= REVEAL_AT
      ? false // near the top: always visible
      : y > lastY + DELTA
        ? true // scrolling down: hide
        : y < lastY - DELTA
          ? false // scrolling up: reveal
          : hidden; // within jitter: hold
  lastY = y;
  if (next !== hidden) {
    hidden = next;
    for (const l of listeners) l();
  }
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    lastY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("scroll", onScroll);
  };
}

// True when the mobile top nav should be tucked away. Defaults to false on the
// server and first client render, so the nav is present through hydration.
export function useHideOnScroll(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}
