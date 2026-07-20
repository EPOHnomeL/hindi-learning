import "~/styles/globals.css";

import { type Metadata } from "next";
import { Spectral, Noto_Serif_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getTenantSlug, getTenantView } from "~/lib/tenant-server";
import { buildTenantThemeCss } from "~/design/tokens";
import { isDevanagari } from "../../convex/languages";

// Per-host metadata (issue 11): a tenant serves its own favicon (and browser-tab
// name), so the whitelabel site never shows the default "My Course" mark. Falls
// back to the shipped defaults on the bare domain / an unseeded host.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantView();
  return {
    title: tenant?.displayName ?? "My Course",
    description: "Your courses — lessons grounded in reading.",
    icons: {
      icon: tenant?.faviconUrl
        ? [{ url: tenant.faviconUrl }]
        : [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/favicon.ico", sizes: "any" },
          ],
    },
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Resolve the tenant server-side (issue 11): the slug is handed to the client
  // provider (one resolution point — issue 10), and the palette is baked into a
  // pre-paint <style> so a tenant host renders in its own skin with no flash.
  const slug = await getTenantSlug();
  const tenant = await getTenantView();
  const themeCss = tenant ? buildTenantThemeCss(tenant.theme) : null;

  // The active chrome locale, resolved from the cookie by getRequestConfig
  // (ticket 04): `<html lang>` reflects it so the document announces the right
  // language on first paint, and the locale seeds NextIntlClientProvider for
  // every Client Component below. `dir` stays ltr — RTL is out of scope.
  const locale = await getLocale();

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang={locale} className={`${spectral.variable} ${notoDeva.variable}`} suppressHydrationWarning>
        <head>
          {/* Tenant palette, before paint: the injected --color-* overrides supply
              both light and (partial) dark values; the dark-mode script below only
              toggles which set applies. On the default site this is absent and the
              globals.css palette governs, unchanged. */}
          {themeCss && <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
          {/* Apply the saved theme before paint so a dark-mode user never flashes
              the light "paper" palette on load. Mirrors hindi:theme / data-theme
              written by ThemeContext (ADR 0011). */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('hindi:theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
            }}
          />
        </head>
        {/* Escape hatch A (ticket 04): a Devanagari chrome locale (Hindi) needs a
            Devanagari-capable face — the Spectral body font has no such glyphs.
            Mirror the reader's isDevanagari handling: swap the body font to Noto
            Devanagari for the whole chrome. Latin text falls back within the stack. */}
        <body className={isDevanagari(locale) ? "font-deva" : undefined}>
          {/* Messages + locale flow to every Client Component from the request
              config (getRequestConfig) — no props needed; the provider inherits
              them server-side. Server Components use getTranslations directly. */}
          <NextIntlClientProvider>
            <ConvexClientProvider tenantSlug={slug}>{children}</ConvexClientProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
