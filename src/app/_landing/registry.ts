import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TenantSlug } from "~/lib/tenant";

// Per-tenant landing pages (whitelabel/16). A slug → bespoke-landing map, plus the
// lookup `page.tsx` uses to pick a tenant's page. Deliberately NOT dashboard content
// (03 decision 4 / 06 / 20): a landing page is hand-authored as a React component and
// registered here, shipping via commit + deploy like any other code — no DB, nothing
// runtime-editable.
//
// Every other tenant falls through to the default <Landing/> (rendered by page.tsx),
// which still re-skins itself via the SSR tenant palette (issue 11). To give a tenant
// a bespoke page, author a component and add a `slug: Component` entry below.
export const LANDING_REGISTRY: Partial<Record<TenantSlug, ComponentType>> = {
  // next/dynamic defers the actual import to render time, so this module stays
  // import-light (no eager pull of the client component tree) — the same
  // constraint that keeps registry.test.ts runnable under the edge-runtime env
  // (vitest's esbuild transform respects tsconfig's `jsx: "preserve"` and can't
  // parse a real .tsx component module as a result).
  ywampotch: dynamic(() => import("./YwamPotch").then((m) => m.YwamPotch)),
};

// The bespoke landing component registered for a resolved tenant slug, or `null` when
// the tenant has none (or this is the default site, slug `null`) — the caller then
// renders the default <Landing/>. Pure and registry-injectable so the lookup is unit-
// testable without importing the client component tree.
export function landingFor(
  slug: TenantSlug | null,
  registry: Partial<Record<TenantSlug, ComponentType>> = LANDING_REGISTRY,
): ComponentType | null {
  return (slug && registry[slug]) || null;
}
