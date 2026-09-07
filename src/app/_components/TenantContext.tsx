"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueries, type RequestForQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import posthog from "posthog-js";
import { api } from "../../../convex/_generated/api";
import type { TenantSlug } from "~/lib/tenant";
import { claimSkewReload, sessionStore } from "~/lib/deploy-skew";
import { isPostHogInitialized } from "../PostHogClient";

// The resolved tenant (displayName, palette, logoUrl, faviconUrl, flags), or
// `null` for the default site / an unseeded host. `undefined` while the client
// query is still loading — only reachable on a tenant host.
export type Tenant = FunctionReturnType<typeof api.tenantTheme.getTheme>;
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
// palette baked into the layout <style> — they ride a plain reactive subscription
// here. Downstream themed surfaces (04 flag-gating, 13 reader, 15 certificate, the
// dashboard) read the tenant from this one place.
export function TenantProvider({ slug, children }: { slug: TenantSlug | null; children: ReactNode }) {
  // Skip the query on the default site — there is no tenant to resolve, so the
  // context settles to `null` rather than sitting on a loading `undefined`.
  // Memoised because useQueries keys its subscription on the object identity, so
  // an inline literal would resubscribe on every render.
  const queries = useMemo(() => {
    const q: RequestForQueries = {};
    if (slug) q.tenant = { query: api.tenantTheme.getTheme, args: { slug } };
    return q;
  }, [slug]);
  // useQueries, not useQuery, for the fallback below: useQuery throws a failed
  // read out through render, and with no error.tsx anywhere that lands in
  // global-error.tsx and takes the whole page down over a skin. useQueries hands
  // the same failure back as a value, on the first read and on an already-open
  // subscription alike (src/lib/deploy-skew.ts has why both matter). It is
  // untyped by design, hence the one cast below.
  const raw: unknown = useQueries(queries).tenant;
  const failure = raw instanceof Error ? raw : null;

  useEffect(() => {
    if (!failure) return;
    // useQueries swallowing the throw also hides the read from exception
    // autocapture, so report it from here or the next Convex rename is silent.
    const reloading = claimSkewReload(sessionStore());
    if (isPostHogInitialized()) {
      posthog.captureException(failure, { tenant_theme_read_failed: true, auto_reloaded: reloading });
    }
    if (!reloading) return;
    // Give that capture a moment to leave the tab before the document does.
    const timer = setTimeout(() => window.location.reload(), 250);
    return () => clearTimeout(timer);
  }, [failure]);

  // A failed read wears the default skin instead of breaking the page. `null` is
  // already this context's own "no tenant" value, so every consumer handles it
  // (displayName falls back to "My Course", the logo to the house mark), and the
  // no-flash palette is baked into the layout <style> server-side, so the colours
  // do not move. A still-loading read stays `undefined`, exactly as before.
  const tenant = failure ? null : (raw as Tenant | undefined);
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
