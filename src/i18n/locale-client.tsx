"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./config";
import { cookieDomainFor } from "~/lib/cookieDomain";

// The render source of truth is the `hindi_locale` cookie (ticket 03). These two
// client writers keep it correct out-of-band from the render path:
//   #1 explicit pick  — useSetLocale (the picker calls it)
//   #2 login sync      — <LocaleSync/> (mounted once, app-wide)
// The third writer (one-time Accept-Language sniff) lives in the middleware.

// Write the cookie with the same attributes the middleware uses, so the cookie
// behaves identically whoever set it.
function writeLocaleCookie(locale: string) {
  // Mirror the middleware's attributes, including the shared parent-domain scope
  // so an explicit pick survives switching subdomains.
  const domain = cookieDomainFor(window.location.host);
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${domainPart}`;
}

function readLocaleCookie(): string | undefined {
  for (const part of document.cookie.split("; ")) {
    const [name, ...rest] = part.split("=");
    if (name === LOCALE_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

// Cookie-writer #1 (explicit pick, ticket 03 §3): write the cookie immediately
// (instant, the render source), persist to the account when signed-in, then
// refresh so Server Components re-render in the new locale with no full reload.
// A guest write is cookie-only — the cookie IS a guest's durable store.
export function useSetLocale(): (locale: string) => void {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const setMyLocale = useMutation(api.userPrefs.setMyLocale);

  return useCallback(
    (locale: string) => {
      writeLocaleCookie(locale);
      if (isAuthenticated) void setMyLocale({ locale });
      router.refresh();
    },
    [isAuthenticated, router, setMyLocale],
  );
}

// Cookie-writer #2 (login sync, ticket 03 §3): once signed in, the account's
// stored locale (the cross-device truth) wins over a stale/absent per-device
// cookie — this is what makes a fresh device Just Work. If the account has no
// stored locale, the existing cookie (guest sniff or pick) stands untouched.
// Renders nothing; mounted once near the app root.
export function LocaleSync() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  // Only query the account truth once authenticated (skip while guest/loading).
  const accountLocale = useQuery(api.userPrefs.getMyLocale, isAuthenticated ? {} : "skip");
  const synced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || accountLocale === undefined) return;
    if (synced.current) return;
    synced.current = true;
    if (accountLocale && accountLocale !== readLocaleCookie()) {
      writeLocaleCookie(accountLocale);
      router.refresh();
    }
  }, [isAuthenticated, accountLocale, router]);

  return null;
}
