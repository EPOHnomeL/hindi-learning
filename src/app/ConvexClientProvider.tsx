"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";
import { ThemeProvider } from "./_components/ThemeContext";
import { TenantProvider } from "./_components/TenantContext";
import type { TenantSlug } from "~/lib/tenant";

// Next inlines NEXT_PUBLIC_* at build; `npx convex dev` writes it to .env.local.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// `tenantSlug` is resolved once server-side (root layout) and handed down, so the
// client never re-parses the host — one resolution point (issue 10 / 11).
export function ConvexClientProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: TenantSlug | null;
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <TenantProvider slug={tenantSlug}>
        <ThemeProvider>{children}</ThemeProvider>
      </TenantProvider>
    </ConvexAuthNextjsProvider>
  );
}
