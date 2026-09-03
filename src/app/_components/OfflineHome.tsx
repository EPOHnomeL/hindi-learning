"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { useTranslations } from "next-intl";
import { useTenant, useTenantSlug } from "./TenantContext";
import { catalogueCacheKey, DASHBOARD_CACHE_KEY, readCache, TENANT_NAME_CACHE_KEY } from "./offlineCache";
import { Logo } from "./Logo";

// What the two cache writers store: just enough to render a recognisable list.
export type CachedCourse = {
  slug: string;
  title: string;
  lessonCount?: number;
  completedCount?: number;
};

// Is this browser offline, as far as the app is concerned? Two signals, either
// suffices: navigator.onLine false (radios off, airplane mode), or the Convex
// WebSocket still unconnected 3s after mount (wifi with no route out, the dead
// router a bare onLine check misses). Starts false so the server render and
// first paint are the online tree; the WebSocket connecting flips it back
// instantly, which is what makes reconnection replace the cached view with live
// data with no reload.
//
// Why HomePage can't hang this off the auth gate instead: offline, Convex
// Auth's server-state fetch fails and the client resolves UNAUTHENTICATED
// (walked 2026-08-24), so a signed-in learner relaunching offline would get the
// marketing landing with a dead sign-in form, not a loading state. The ticket's
// useQuery-sits-undefined-forever trap is real but sits BEHIND that gate.
export function useOffline(): boolean {
  const connection = useConvexConnectionState();
  const [onLine, setOnLine] = useState(true);
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const update = () => setOnLine(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const timer = setTimeout(() => setGraceOver(true), 8000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearTimeout(timer);
    };
  }, []);
  // hasEverConnected keeps this honest on a slow mobile first connect and
  // between reconnect retries: a phone that reached Convex once this page load
  // is ONLINE with a blip, never "offline" (a learner online saw the offline
  // view on 2026-08-24: 3s grace was shorter than their first WS connect). The
  // grace path exists only for the boot that never connects at all.
  return !onLine || (graceOver && !connection.isWebSocketConnected && !connection.hasEverConnected);
}

// The Offline Catalogue (installable-app ticket 05, ADR 0030 §3): the last saved
// course list with a quiet note, or an honest empty state on a first-ever visit.
// Tapping a course offline shows a plain "needs a connection" line instead of
// navigating into a hang. Rendered by HomePage whenever useOffline() is true;
// reconnecting flips it back to the live tree without a reload.
//
// Progress on the cached list may be slightly stale by design: it is a list,
// and the live query overwrites the cache within a second of reconnecting.
export function OfflineHome() {
  const t = useTranslations("Offline");
  const tenant = useTenant();
  const slug = useTenantSlug();
  const [tapped, setTapped] = useState(false);

  // Read on render, not in state: offline nothing else writes these keys, and a
  // reconnect unmounts this whole branch. The signed-in dashboard list wins over
  // the public catalogue when it has anything in it (a learner with no courses
  // still gets the tenant's catalogue); the sign-out sweep clears both.
  const dash = readCache<CachedCourse[]>(window.localStorage, DASHBOARD_CACHE_KEY);
  const list = dash?.length ? dash : readCache<CachedCourse[]>(window.localStorage, catalogueCacheKey(slug));
  // The live tenant query is unreachable offline, so the header name comes from
  // the cache the Dashboard keeps; without it a whitelabel host reads "My Course".
  const name =
    tenant?.displayName ?? readCache<string>(window.localStorage, TENANT_NAME_CACHE_KEY) ?? "My Course";

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <Logo className="h-9 w-9 shrink-0 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight text-accent">{name}</h1>
      </header>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-soft">{t("note")}</p>
        {/* A reload is the full retry: it re-runs the connection attempt AND
            re-mints the auth client's tokens from the cookie (see HomePage). */}
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-accent"
        >
          {t("retry")}
        </button>
      </div>
      {tapped && (
        <p aria-live="polite" className="mb-4 rounded-lg border border-line bg-card p-3 text-sm text-ink">
          {t("needsConnection")}
        </p>
      )}
      {list && list.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => setTapped(true)}
                className="w-full rounded-2xl border border-line bg-card p-5 text-start shadow-sm"
              >
                <span className="block text-lg font-semibold leading-snug text-ink">{c.title}</span>
                {c.lessonCount !== undefined && c.completedCount !== undefined && (
                  <span className="mt-1 block text-sm text-soft">
                    {c.completedCount}/{c.lessonCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-soft">{t("nothingSaved")}</p>
      )}
    </div>
  );
}
