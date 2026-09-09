"use client";

import { useEffect, useState } from "react";
import { cachedCourseCount } from "./offlineCache";

// **How many placeholder cards the home grid should draw** while the dashboard
// query is in flight (perceived-performance ticket 06).
//
// Before this, a cold load of `/` painted the course area three times at three
// different heights: `DashboardSkeleton` drew SIX cards during `AuthLoading`,
// then `Dashboard`'s own inline skeleton drew THREE, then the real grid drew
// however many the learner has. Two layout jumps, one of them a shrink, before
// any content arrived. The root layout's `scrollRestoration = 'manual'` script
// exists because of the second one; this removes the cause rather than the
// symptom, and that script stays (it still covers the cold-load case).
//
// **A separate module rather than an addition to `offlineCache.ts`**, for the
// reason `useStoredSet.ts` already records beside it: `offlineCache` is pure over
// a passed `Storage` precisely so it tests without a DOM, and a hook would end
// that. The counting half is pure and lives there; only the React half is here.
//
// **Read in an effect, not during render**, and the ordering is deliberate.
// `Dashboard` renders under `<Authenticated>`, and with `ConvexAuthNextjsServerProvider`
// the auth state can be known server-side, so this tree may genuinely be
// server-rendered. Touching `localStorage` during render would be a hydration
// mismatch at best. The effect runs immediately after the first paint, which is
// still far ahead of the dashboard query: that needs a Convex websocket
// handshake, so the cached count is in place well before any content lands.
export function useCourseGridCount(fallback: number): number {
  const [count, setCount] = useState(fallback);
  useEffect(() => {
    const cached = cachedCourseCount(window.localStorage);
    if (cached !== null) setCount(cached);
  }, []);
  return count;
}
