"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Theme } from "./lessonSrcDoc";

// App-wide light/dark, owned by the app rather than the lesson (ADR 0011). The
// choice lives on <html data-theme> (so the Tailwind color tokens re-skin the
// whole app) and is persisted per-device. A pre-paint script in layout.tsx
// applies it before React hydrates, so this provider only needs to read back
// what's already there and let the sidebar toggle change it.
//
// Persisted in a COOKIE (not localStorage) so the server can read it on the render
// path. Deliberately **host-only** — no `Domain` — so each tenant subdomain keeps
// its own light/dark choice (ADR 0025), like its own session and language.
// Underscore name (RFC 6265 token), mirroring the locale cookie. Not httpOnly: the
// pre-paint script reads it in the browser.
//
// Renamed from `hindi_theme` with the cookie-scope change, and the rename is
// load-bearing: the old parent-domain cookie is still in browsers with a year of
// max-age, and a host-only cookie of the SAME name would not replace it — the
// browser would keep both and send both, letting the stale shared value silently
// win forever. A new name makes that collision impossible.
export const THEME_COOKIE = "hindi_mode";
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
    // No `domain` — host-only, so this tenant's choice stays this tenant's.
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }

  const value: ThemeCtx = { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
