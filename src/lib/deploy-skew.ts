// Surviving Convex deploy skew on the tenant theme read.
//
// On 2026-09-04 two learners on the ywampotch tenant got "Server Error" back
// from `tenants:getTheme` for about an hour. Nothing was broken: commit a0789bf
// had moved the theme surface into convex/tenantTheme.ts two and a half hours
// earlier, so the function those browsers were still calling had stopped
// existing on the deployment. A production Convex deploy redacts every uncaught
// server error, so the client cannot tell that case apart from a real handler
// failure, which is why this reacts to "the read failed" and never to a message.
//
// Error tracking split it into two fingerprints, and the second failed on an
// already-open subscription rather than on the first read, so a fallback has to
// cover the live path too. That is what `useQueries` buys in TenantContext: the
// watch hands an Error back as a value on either path instead of throwing it
// through render.
//
// Reloading the document is the actual cure, since navigations are network-first
// in public/sw.js so it comes back naming the current bundle. Once per tab only:
// if the read still fails after that, the deployment genuinely cannot serve it,
// and a reload loop is a far worse failure than a page wearing the default skin.

// The store this needs: sessionStorage in the browser, a stub in the test, and
// `null` where sessionStorage is unreachable (it throws outright in some
// locked-down embedded webviews), in which case we never auto-reload at all,
// because without somewhere to record the attempt the one-shot guard is gone.
export type ReloadStore = Pick<Storage, "getItem" | "setItem">;

// Per tab, and it dies with the tab: a fresh tab has already picked up the new
// bundle, so it has nothing to recover from.
const RELOAD_KEY = "tenant-skew-reload-attempted";

// Claiming the reload is what records it, which is why this is one function
// rather than a predicate plus a setter that a caller could forget to run.
export function claimSkewReload(store: ReloadStore | null): boolean {
  if (!store) return false;
  if (store.getItem(RELOAD_KEY) === "1") return false;
  store.setItem(RELOAD_KEY, "1");
  return true;
}

// sessionStorage access throws, rather than returning null, when storage is denied.
// ponytail: this is a copy of the same two helpers in src/lib/chunk-error.ts on
// the open PR #123, deliberately, so neither branch has to land before the other.
// Collapse them into one shared reload-claim module once both are on main.
export function sessionStore(): ReloadStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
