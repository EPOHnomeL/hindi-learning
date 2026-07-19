"use client";

import { useSearchParams } from "next/navigation";
import { canonicalRedirect, type TenantSlug } from "~/lib/tenant";

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

// The absolute URL of a course's public `/share/<token>` Guest reader, minted on
// its canonical host — the tenant subdomain (or apex for a default-site course) —
// so a link shared out of the app always points at the course on the right skin.
// Null on the server (no `window`). Used by the reference card share (reference-
// cards/03) and the certificate share; keep it the one place this URL is built.
export function publicCourseUrl(shareToken: string, tenantSlug: string | null): string | null {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.origin);
  u.pathname = `/share/${shareToken}`;
  return canonicalRedirect(u.toString(), (tenantSlug as TenantSlug | null) ?? null) ?? u.toString();
}
