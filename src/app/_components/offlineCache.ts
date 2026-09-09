// Last-known-good storage for the Offline Catalogue (installable-app ticket 05,
// ADR 0030 §3). Convex is a WebSocket: offline it never connects and useQuery
// sits at `undefined` forever, indistinguishable from loading, so no error path
// exists to hook. Instead the two course-list queries write their latest result
// here, and the home page renders it whenever the live value is still undefined.
//
// Under the "hindi:" prefix and deliberately NOT in accountLocalState's KEEP
// set: the dashboard list is per-account, so the sign-out sweep clearing these
// is exactly right and handles a shared browser for free (pinned by a test
// beside the sweep's own).
export const DASHBOARD_CACHE_KEY = "hindi:cache:dashboard";

// The tenant's display name, so the offline header doesn't read "My Course" on
// a whitelabel host (seen on ywampotch, 2026-08-24). Branding, not account
// state, but it rides the same sweep as the lists: worst case after sign-out is
// the default name, not a wrong list.
export const TENANT_NAME_CACHE_KEY = "hindi:cache:tenant-name";

export function catalogueCacheKey(tenantSlug: string | null): string {
  return `hindi:cache:catalogue:${tenantSlug ?? "default"}`;
}

// Pure over the passed Storage so they test without a DOM; corrupt JSON and a
// throwing storage both read as "nothing cached", so the worst failure mode is
// the honest empty-offline state.
export function readCache<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

// How many course cards this browser saw last time, for sizing the home grid's
// placeholder (perceived-performance ticket 06).
//
// The dashboard already writes its list here on every resolve, for the Offline
// Catalogue. Reusing it costs one read and no new key, and it is the ONLY honest
// answer to "how many cards will there be?" available before the query lands.
//
// Clamped to 1..6. The list can be long and a screenful of placeholders for a
// learner with two courses is a worse first paint than too few; the floor keeps
// a brand new account from painting nothing at all.
//
// `null` when nothing is cached (a first-ever visit, or after the sign-out
// sweep), which the caller reads as "use the default".
export function cachedCourseCount(storage: Storage): number | null {
  const cached = readCache<unknown[]>(storage, DASHBOARD_CACHE_KEY);
  if (!Array.isArray(cached) || cached.length === 0) return null;
  return Math.min(cached.length, 6);
}

export function writeCache(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the cache is best-effort */
  }
}
