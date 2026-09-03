import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Spectral, Noto_Serif_Devanagari, Noto_Naskh_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { PostHogClient } from "./PostHogClient";
import { AppTabs } from "./_components/AppTabs";
import { RegisterServiceWorker } from "./_components/RegisterServiceWorker";
import { PwaSplash } from "./_components/PwaSplash";
import { headers } from "next/headers";
import { getTenantSlug, getTenantView } from "~/lib/tenant-server";
import { buildTenantThemeCss } from "~/design/tokens";
import { pwaThemeColor } from "~/lib/pwa";
import { isDevanagari, isRtl, langDir } from "../../convex/languages";

// Per-host metadata (issue 11): a tenant serves its own favicon (and browser-tab
// name), so the whitelabel site never shows the default "My Course" mark. Falls
// back to the shipped defaults on the bare domain / an unseeded host.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantView();
  return {
    title: tenant?.displayName ?? "My Course",
    description: "Your courses — lessons grounded in reading.",
    // The installable-app surface (ticket 01): the per-tenant manifest route and
    // the derived apple-touch-icon (iOS ignores manifest icons).
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: tenant?.displayName ?? "My Course" },
    // Next's appleWebApp emits the modern `mobile-web-app-capable`; pre-16.4 iOS
    // only reads the apple-prefixed original, so emit that one too.
    other: { "apple-mobile-web-app-capable": "yes" },
    icons: {
      icon: tenant?.faviconUrl
        ? [{ url: tenant.faviconUrl }]
        : [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/favicon.ico", sizes: "any" },
          ],
      apple: [{ url: "/app-icon?size=180", sizes: "180x180", type: "image/png" }],
    },
  };
}

// themeColor must be per-tenant like everything else, so it is a generate
// function, not a static viewport export (installable-app ticket 01).
export async function generateViewport(): Promise<Viewport> {
  const tenant = await getTenantView();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: pwaThemeColor(tenant),
  };
}

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
});
const notoDeva = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-noto-deva",
});
// Escape hatch B, the Arabic-script twin of notoDeva: Spectral has no Arabic
// glyphs either, so Urdu chrome would render as tofu without a face of its own.
// Naskh rather than Nastaliq deliberately (technical-foundation ticket 09, s4):
// Nastaliq is what an Urdu reader expects for running prose, but its sloping
// baseline needs roughly double the line-height, and the chrome is full of
// fixed-height controls (the bottom tab bar, buttons, badges, the line-clamped
// card subtitles pinned at min-h-[38px]) that would clip or reflow. Naskh is the
// ordinary face for Urdu UI for exactly that reason, and it needs no global
// line-height change.
const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-noto-naskh",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Resolve the tenant server-side (issue 11): the slug is handed to the client
  // provider (one resolution point — issue 10), and the palette is baked into a
  // pre-paint <style> so a tenant host renders in its own skin with no flash.
  const slug = await getTenantSlug();
  const tenant = await getTenantView();
  // The buyer's country for regional pricing (ticket 21), read here and handed
  // down for the same reason as the slug: one resolution point, and the client
  // cannot see the header at all.
  //
  // Read straight off the request, with no middleware restamp: Vercel sets
  // `x-vercel-ip-country` at the edge and OVERWRITES it there, so an inbound
  // value from a client can't survive to be read here. (The tenant slug needs
  // stamping only because it is *derived* from Host — see the note in
  // `src/middleware.ts`, left by ticket 20 so this doesn't get re-added.)
  //
  // **Null off Vercel**, which is every local dev run, and `regionForCountry`
  // reads that as the base ZAR price — failing to the cheapest price, whose cost
  // is margin rather than an overcharge to defend.
  const country = (await headers()).get("x-vercel-ip-country");
  const themeCss = tenant ? buildTenantThemeCss(tenant.theme) : null;

  // The active chrome locale, resolved from the cookie by getRequestConfig
  // (ticket 04): `<html lang>` reflects it so the document announces the right
  // language on first paint, and the locale seeds NextIntlClientProvider for
  // every Client Component below. `dir` comes from the same locale via langDir(),
  // so an RTL chrome language flips the whole document (2026-09-03, Urdu; this
  // line previously said RTL was out of scope, and it no longer is). The lesson
  // iframe is a separate document and keeps its own per-Edition direction, so
  // RTL chrome around an LTR lesson is a supported pair, and so is its opposite.
  const locale = await getLocale();

  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang={locale}
        dir={langDir(locale)}
        className={`${spectral.variable} ${notoDeva.variable} ${notoNaskh.variable}`}
        suppressHydrationWarning
      >
        <head>
          {/* Tenant palette, before paint: the injected --color-* overrides supply
              both light and (partial) dark values; the dark-mode script below only
              toggles which set applies. On the default site this is absent and the
              globals.css palette governs, unchanged. */}
          {themeCss && <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
          {/* Apply the saved theme before paint so a dark-mode user never flashes
              the light "paper" palette on load. Reads the host-only `hindi_mode`
              cookie written by ThemeContext — per-tenant, not shared across
              subdomains (ADR 0025) — falling back to the legacy `hindi:theme`
              localStorage key for not-yet-migrated users (ADR 0011).
              The cookie name is hardcoded in the regex below: it is inside an
              inline string, so neither the type checker nor a rename tool can see
              it. Keep it in sync with THEME_COOKIE or every page paints light and
              then flashes to dark. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var m=document.cookie.match(/(?:^|; )hindi_mode=(dark|light)/);var t=m?m[1]:localStorage.getItem('hindi:theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
            }}
          />
          {/* Open at the top, always. The dashboard's content arrives from Convex
              *after* first paint, so the browser's own scroll restoration lands on
              a short skeleton, then the grid grows underneath it and the learner is
              left staring at the footer. Next's App Router does its own scroll
              handling for client navigations, so turning the browser's off only
              affects a cold document load, which is exactly the launch we want at
              the top. Must run before paint, hence an inline script. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{if('scrollRestoration' in history)history.scrollRestoration='manual';}catch(e){}`,
            }}
          />
        </head>
        {/* The two script escape hatches, in priority order. Spectral carries only
            Latin glyphs, so a chrome locale in another script renders as tofu
            without a face of its own: Devanagari for Hindi (hatch A, ticket 04),
            Naskh for Urdu and any other Arabic-script locale (hatch B, added
            2026-09-03). Devanagari is tested first because the two sets are
            disjoint and isDevanagari is the narrower question. Latin text inside
            either falls back within the stack. */}
        <body className={isDevanagari(locale) ? "font-deva" : isRtl(locale) ? "font-naskh" : undefined}>
          {/* First thing in the body, and outside every provider: the launch
              screen an installed app draws for itself, so a whitelabel PWA opens
              on its own mark with the platform named at the foot. Server markup
              only, gated in CSS on display-mode, so a browser tab never sees it. */}
          <PwaSplash displayName={tenant?.displayName ?? "My Course"} faviconUrl={tenant?.faviconUrl ?? null} />
          <PostHogClient />
          {/* Messages + locale flow to every Client Component from the request
              config (getRequestConfig) — no props needed; the provider inherits
              them server-side. Server Components use getTranslations directly. */}
          <NextIntlClientProvider>
            <ConvexClientProvider tenantSlug={slug} country={country}>
              {children}
              {/* The app-level bottom tab bar (mobile, signed in only). This is
                  the one mount point present on Home, in the reader and on
                  /admin alike; it also appends the spacer that keeps the fixed
                  bar off the last row of every page. */}
              <AppTabs />
              <RegisterServiceWorker />
            </ConvexClientProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
