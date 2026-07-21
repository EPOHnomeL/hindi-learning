"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Theme } from "./lessonSrcDoc";
import { cookieDomainFor } from "~/lib/cookieDomain";

// App-wide light/dark, owned by the app rather than the lesson (ADR 0011). The
// choice lives on <html data-theme> (so the Tailwind color tokens re-skin the
// whole app) and is persisted per-device. A pre-paint script in layout.tsx
// applies it before React hydrates, so this provider only needs to read back
// what's already there and let the sidebar toggle change it.
//
// Persisted in a COOKIE (not localStorage) so the preference is scoped to the
// shared parent domain and survives switching between tenant subdomains — the
// same reason the locale and auth-session cookies are parent-scoped. Underscore
// name (RFC 6265 token), mirroring the locale cookie. Not httpOnly: the pre-paint
// script reads it in the browser.
export const THEME_COOKIE = "hindi_theme";
const LEGACY_KEY = "hindi:theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year, like the locale cookie

type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync from what the pre-paint script already put on <html> (or the default),
  // then migrate a legacy localStorage preference into the cookie once so a
  // returning dark-mode user isn't reset to light by the storage move.
  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    if (attr === "dark" || attr === "light") {
      setThemeState(attr);
      return;
    }
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === "dark" || legacy === "light") setTheme(legacy);
    } catch {
      /* storage unavailable — stay on the default */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    const domain = cookieDomainFor(window.location.host);
    const domainPart = domain ? `; domain=${domain}` : "";
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${domainPart}`;
  }

  const value: ThemeCtx = { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
