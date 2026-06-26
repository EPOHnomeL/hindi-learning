"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Theme } from "./lessonSrcDoc";

// App-wide light/dark, owned by the app rather than the lesson (ADR 0011). The
// choice lives on <html data-theme> (so the Tailwind color tokens re-skin the
// whole app) and is persisted per-device. A pre-paint script in layout.tsx
// applies it before React hydrates, so this provider only needs to read back
// what's already there and let the sidebar toggle change it.
const KEY = "hindi:theme";

type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync from what the pre-paint script already put on <html> (or the default).
  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    if (attr === "dark" || attr === "light") setThemeState(attr);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode / storage disabled — theme still applies for this session */
    }
  }

  const value: ThemeCtx = { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
