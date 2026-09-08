"use client";

import { useCallback, useEffect, useState } from "react";
import { readCache, writeCache } from "./offlineCache";

// **A `Set<string>` that survives a reload.** The routine both readers wrote by
// hand: load a JSON array off `localStorage` on mount, keep it as a Set, add to
// it, write it back, and swallow whatever storage throws.
//
// Surfaced by the 2026-09-08 architecture walk. `CourseShell` used it for the
// answered-question ids a device has seen, and `PublicReader` for the lessons a
// Guest has ticked off, and the two were the same twenty lines with different
// names and two empty catches.
//
// **It is a separate module rather than an addition to `offlineCache.ts`, which
// is where the walk suggested putting it.** `offlineCache` is pure over a passed
// `Storage` precisely so it tests without a DOM, and a hook would end that. So
// the storage half stays there and is reused here, which is the part that was
// actually duplicated.
//
// **The other raw storage sites are deliberately left alone.** Most of them store
// a bare string flag (`"1"`, a locale, a token), and routing those through
// `readCache`/`writeCache` would JSON-encode them, changing what is already
// written in every existing browser: a silent data migration in exchange for
// tidiness. `accountLocalState.ts` needs to enumerate keys for the sign-out
// sweep, and `layout.tsx`'s inline script runs before hydration, so neither can
// use a hook at all.
export type StoredSet = {
  // The set itself, for the callers that pass it onward. `PublicReader` puts it
  // in a context and hands it to three components, so hiding it behind `has`
  // would only make each of them take a callback instead.
  values: ReadonlySet<string>;
  has: (value: string) => boolean;
  // Add one value, idempotently. A value already present is a no-op, including
  // no write.
  add: (value: string) => void;
  // Replace the whole set. `next` receives the current set and may return it
  // unchanged to mean "nothing to do", which is what `CourseShell`'s
  // mark-many-seen does when a lesson has no new replies.
  update: (next: (prev: ReadonlySet<string>) => Set<string>) => void;
  // Whether the stored value has been read yet. `false` is NOT the same as "the
  // set is empty", and the difference is load-bearing: the welcome panel turns on
  // an empty set, so without this a returning Guest gets a flash of "welcome" on
  // every visit.
  loaded: boolean;
};

export function useStoredSet(key: string): StoredSet {
  const [values, setValues] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // A new key is a different set, so this resets rather than merges: the Guest
    // reader keys by Public link scope, and carrying one link's ticks onto
    // another would credit progress nobody made.
    const stored = readCache<string[]>(localStorage, key);
    setValues(new Set(stored ?? []));
    setLoaded(true);
  }, [key]);

  const update = useCallback(
    (next: (prev: ReadonlySet<string>) => Set<string>) => {
      setValues((prev) => {
        const after = next(prev);
        if (after === prev) return prev;
        writeCache(localStorage, key, [...after]);
        return after;
      });
    },
    [key],
  );

  const add = useCallback(
    (value: string) => update((prev) => (prev.has(value) ? (prev as Set<string>) : new Set(prev).add(value))),
    [update],
  );

  const has = useCallback((value: string) => values.has(value), [values]);

  return { values, has, add, update, loaded };
}
