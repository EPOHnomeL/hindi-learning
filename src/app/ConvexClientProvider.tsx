"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient, useQuery } from "convex/react";
import posthog from "posthog-js";
import { type ReactNode, useEffect } from "react";
import { ThemeProvider } from "./_components/ThemeContext";
import { TenantProvider } from "./_components/TenantContext";
import { CountryProvider } from "./_components/CountryContext";
import { LocaleSync } from "~/i18n/locale-client";
import type { TenantSlug } from "~/lib/tenant";
import { api } from "../../convex/_generated/api";
import { isPostHogInitialized } from "./PostHogClient";

// Next inlines NEXT_PUBLIC_* at build; `npx convex dev` writes it to .env.local.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Identifies after Convex has resolved a signed-in account, including on a page
// refresh. `id` is the immutable Convex user document ID; email and name remain
// person properties, never event properties.
function PostHogIdentity() {
  const user = useQuery(api.users.me);

  useEffect(() => {
    if (!user || !isPostHogInitialized()) return;

    posthog.identify(user.id, {
      ...(user.email ? { email: user.email } : {}),
      ...(user.name ? { name: user.name } : {}),
    });
  }, [user]);

  return null;
}

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
          <PostHogIdentity />
          <ThemeProvider>{children}</ThemeProvider>
        </TenantProvider>
      </CountryProvider>
    </ConvexAuthNextjsProvider>
  );
}
