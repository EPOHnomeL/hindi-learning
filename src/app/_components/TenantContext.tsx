"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { TenantSlug } from "~/lib/tenant";

// The resolved tenant (displayName, palette, logoUrl, faviconUrl, flags), or
// `null` for the default site / an unseeded host. `undefined` while the client
// query is still loading — only reachable on a tenant host.
export type Tenant = FunctionReturnType<typeof api.tenants.getTheme>;
type TenantCtx = Tenant | undefined;

const Ctx = createContext<TenantCtx>(undefined);

// The resolved slug itself, separate from the tenant view. The landing-page
// registry (issue 16) keys on the slug (not the theme), and it must be readable
// while <Unauthenticated> — before/without the getTheme query — so it rides its
// own context rather than being derived from the tenant object (which omits slug).
const SlugCtx = createContext<TenantSlug | null>(null);

// The single client seam for tenant identity (issue 11 / decision 03 #5). The
// server resolves the slug once (no client host-parsing) and passes it down; the
// logo, brand name, and feature flags are flash-tolerant, so — unlike the no-flash
// palette baked into the layout <style> — they ride a plain reactive `useQuery`
// here. Downstream themed surfaces (04 flag-gating, 13 reader, 15 certificate, the
// dashboard) read the tenant from this one place.
export function TenantProvider({ slug, children }: { slug: TenantSlug | null; children: ReactNode }) {
  // Skip the query on the default site — there is no tenant to resolve, so the
  // context settles to `null` rather than sitting on a loading `undefined`.
  const tenant = useQuery(api.tenants.getTheme, slug ? { slug } : "skip");
  const value: TenantCtx = slug ? tenant : null;
  return (
    <SlugCtx.Provider value={slug}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </SlugCtx.Provider>
  );
}

export function useTenant(): TenantCtx {
  return useContext(Ctx);
}

// The resolved tenant slug (`null` on the default site). For consumers that key on
// tenant identity rather than its theme — e.g. the landing-page registry (issue 16).
export function useTenantSlug(): TenantSlug | null {
  return useContext(SlugCtx);
}
