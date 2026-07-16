"use client";

import { useSearchParams } from "next/navigation";

// The reader's Edition language lives in the URL as `?lang=<code>` (course-
// translation). English is the default and carries no param, so an English URL
// stays clean and `?lang=en` is treated the same as absent. Every reader query
// threads this through; the backend honours it only if the caller holds that
// Edition (else it falls back), so the client just passes it along.

// localStorage key for the reader's last-used Edition — mirrors ThemeContext's
// "hindi:theme". Written on switch, read to reopen a course in that language.
export const LANG_KEY = "hindi:lang";

// The current Edition language from the URL, or null for the default English.
export function useEditionLang(): string | null {
  const params = useSearchParams();
  const lang = params.get("lang");
  return lang && lang !== "en" ? lang : null;
}

// Append `?lang=<code>` to a reader href so the current Edition survives
// navigation. English ("en") / null is the default and adds no param.
export function withLang(href: string, lang: string | null | undefined): string {
  if (!lang || lang === "en") return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}lang=${encodeURIComponent(lang)}`;
}

// The Buy marker (`?buy=1`, auth-first checkout ADR 0021): set when a share
// reader's Buy CTA routed the visitor here. SignIn defaults to "Create account"
// on it, and the locked authed reader auto-opens the buy dialog.
export function useBuyMarker(): boolean {
  return useSearchParams().get("buy") === "1";
}
