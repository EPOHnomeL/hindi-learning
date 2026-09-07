// Recovering from a ChunkLoadError instead of dying on it.
//
// A ChunkLoadError means the browser asked for a JavaScript chunk this document
// expects and did not get it. Two ways that happens here, and both are ordinary:
//
//   1. The network stalled or dropped on a cache miss. public/sw.js resolves that
//      case with `Response.error()` on purpose (a rejected respondWith would be
//      worse), so the chunk is simply unavailable until the network returns.
//      This is the one we have actually observed in production: all three events
//      on 2026-09-04 were webpack's `timeout:` or `(error: ...)` variants, never
//      a 404, and they sit in one two-minute window a day after the nearest
//      deploy. Note the worker's fetch guard was already live when they fired
//      (c2049dd, 2026-09-04), which is why guarding the worker is not on its own
//      enough and this file exists.
//   2. A deploy landed while the tab was open. Chunk names are content-hashed,
//      so the old document references files the new deploy no longer serves, and
//      the next lazy import 404s. Plausible and worth handling, but not what the
//      reported failures were.
//
// Neither is a bug in the page, and both are cured by loading the document
// again: navigations are network-first in the worker, so a reload fetches fresh
// HTML naming chunks that exist. Before 2026-09-07 nothing did that, and the
// error fell through to global-error.tsx, whose `reset()` re-renders the same
// tree and re-requests the same missing chunk, so the page was dead. That last
// step is observed, not inferred: on 2026-09-04 at 03:36:37Z a user clicked this
// boundary's "Try again" button and the identical ChunkLoadError was captured
// 35ms later, then they left the site. See PR #123 for the full evidence.

// Chunk failures reach us under several names depending on who threw: webpack's
// loader sets `name`, while a native dynamic import rejects with a plain
// TypeError whose message is the only signal.
const CHUNK_MESSAGE =
  /Loading (?:CSS )?chunk .+ failed|(?:Failed to fetch|error loading) dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_MESSAGE.test(message);
}

// The one-shot flag, in sessionStorage so it is per tab and dies with it.
const RELOAD_KEY = "chunk-reload-attempted";

// The store this needs: sessionStorage in the browser, a stub in the test, and
// `null` where sessionStorage is unreachable (it throws outright in some
// locked-down embedded webviews).
export type ReloadStore = Pick<Storage, "getItem" | "setItem">;

// Reload at most once per tab. A loop is a worse failure than the dead page it
// replaces: if the reload produced the same error, the chunk is genuinely
// unreachable (device offline, mid-deploy edge), so we stop and let the human
// decide with a button. Deciding to reload records the attempt, which is why
// this is one function and not a predicate.
export function claimChunkReload(error: unknown, store: ReloadStore | null): boolean {
  if (!isChunkLoadError(error) || !store) return false;
  if (store.getItem(RELOAD_KEY) === "1") return false;
  store.setItem(RELOAD_KEY, "1");
  return true;
}

// sessionStorage access throws, rather than returning null, when storage is denied.
export function sessionStore(): ReloadStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
