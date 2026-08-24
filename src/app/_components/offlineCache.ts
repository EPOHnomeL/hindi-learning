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

export function writeCache(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the cache is best-effort */
  }
}
