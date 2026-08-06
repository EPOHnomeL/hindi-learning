"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";
import { ThemeProvider } from "./_components/ThemeContext";
import { TenantProvider } from "./_components/TenantContext";
import { CountryProvider } from "./_components/CountryContext";
import { LocaleSync } from "~/i18n/locale-client";
import type { TenantSlug } from "~/lib/tenant";

// Next inlines NEXT_PUBLIC_* at build; `npx convex dev` writes it to .env.local.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// `tenantSlug` is resolved once server-side (root layout) and handed down, so the
// client never re-parses the host — one resolution point (issue 10 / 11).
export function ConvexClientProvider({
  tenantSlug,
  country,
  children,
}: {
  tenantSlug: TenantSlug | null;
  // The buyer's `x-vercel-ip-country`, resolved in the root layout — same
  // one-resolution-point rule as the slug (regional pricing, ticket 21).
  country: string | null;
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <CountryProvider country={country}>
        <TenantProvider slug={tenantSlug}>
          {/* Login-sync (ticket 03 §3): seeds the locale cookie from the account's
              stored preference on a fresh device. Renders nothing. */}
          <LocaleSync />
          <ThemeProvider>{children}</ThemeProvider>
        </TenantProvider>
      </CountryProvider>
    </ConvexAuthNextjsProvider>
  );
}
