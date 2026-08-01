"use client";

import { useSearchParams } from "next/navigation";
import { canonicalRedirect, type TenantSlug } from "~/lib/tenant";

// The reader's Edition language lives in the URL as `?lang=<code>` (course-
// translation). ABSENT means "no preference" — the backend then serves a held
// Edition (resolveEdition's fallback). PRESENT — including an explicit
// `?lang=en` — is a request for exactly that Edition: the backend serves it in
// full when held, or as the paid Preview (paygate) when it's priced. Explicit
// "en" must never be collapsed to absent: on a course whose paid English
// Edition coexists with a free published translation, an implicit request
// falls back to the free Edition — which silently replaced the buy flow with
// free foreign-language content (the prod checkout bug). Only links that carry
// no language stay clean.

// localStorage key for the reader's last-used Edition — mirrors ThemeContext's
// "hindi:theme". Written on switch, read to reopen a course in that language.
export const LANG_KEY = "hindi:lang";

// The current Edition language from the URL — "en" included — or null when the
// URL carries no preference.
export function useEditionLang(): string | null {
  const params = useSearchParams();
  return params.get("lang") || null;
}

// Append `?lang=<code>` to a reader href so the current Edition survives
// navigation — "en" included (an explicit Edition stays pinned; see the header
// note). Only null/undefined (no preference) adds no param.
export function withLang(href: string, lang: string | null | undefined): string {
  if (!lang) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}lang=${encodeURIComponent(lang)}`;
}

// The checkout page for one Edition (auth-first, ADR 0021 — ywampotch-launch/12).
// Every "Unlock the full course" CTA points here, from the Guest reader and the
// authed one alike; signed out, `AppGate` renders `SignIn` at this URL and
// returns to it after auth, so there is no marker to carry across the hop.
//
// `lang` is a path SEGMENT and always explicit, "en" included: left implicit,
// `resolveEdition` serves any free published Edition of the course instead of
// this paid one's paygate (the prod checkout bug — see the header note above).
// A segment cannot be dropped by a future caller the way a query param can.
export function checkoutLink(slug: string, lang: string): string {
  return `/checkout/${slug}/${encodeURIComponent(lang)}`;
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
