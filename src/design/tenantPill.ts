// The tenant pill on a course card (whitelabel ticket 25). An operator ask: the
// default site lists EVERY course (the pinned v1 catalogue policy), so an owner
// looking at `my-course.app` sees four tenants' courses in one undifferentiated
// grid with nothing saying which is whose.
//
// The colour is a deterministic slug→colour map here, NOT the tenant's own
// `theme.light.accent`: `getTheme` is a single-tenant host-keyed read (issue 11),
// so pulling real accents for a grid spanning four tenants would need a whole new
// list-shaped query — and two tenants are free to pick near-identical accents,
// which is the one thing a distinguishing pill must not do. Four known tenants,
// four hand-picked hues (ticket 25, option (b)).
//
// The hues sit at a middling lightness on purpose: the pill paints as `colour` text
// on a `colour`-tinted background via `color-mix`, so one hex has to stay legible on
// both the light card and the dark one. They are deliberately NOT the design
// system's own tokens — `gold`/`accent2` already mean "paid"/"public" on this card.

// Relative, not the `~/` alias: this module is unit-tested under vitest, whose
// resolver has no path aliases (same reason src/lib/tenant.test.ts imports locally).
import type { TenantSlug } from "../lib/tenant";

export type TenantPill = { label: string; colour: string };

// Labels mirror the display names seeded in scripts/seed-tenants.ts — short enough
// for a pill, and what the operator calls each tenant.
export const TENANT_PILLS: Record<TenantSlug, TenantPill> = {
  upf: { label: "UPF", colour: "#0f9b8e" },
  ywampotch: { label: "YWAM Potch", colour: "#5b5bd6" },
  "almighty-warriors": { label: "Almighty Warriors", colour: "#c2367f" },
  yknot: { label: "Y-Knot", colour: "#c96a1e" },
};

// The whole pill-or-no-pill decision, pure so the host rule is tested rather than
// eyeballed on one host. `host` is the tenant the page is being served on
// (`useTenantSlug()`, `null` on `my-course.app` / `www.my-course.app`);
// `courseTenant` is the course's own `tenantSlug`.
//
// Two ways to get nothing, both intentional:
//   - on a tenant subdomain every listed course is that tenant's by construction
//     (ticket 02's visibility filter), so the pill would be pure noise;
//   - an untenanted course is default-site-only — there is no tenant to name, and
//     no pill is quieter than a neutral one. An unknown slug degrades the same way.
export function tenantPill(
  host: TenantSlug | null,
  courseTenant: string | null | undefined,
): TenantPill | null {
  if (host !== null) return null;
  if (!courseTenant) return null;
  return TENANT_PILLS[courseTenant as TenantSlug] ?? null;
}
