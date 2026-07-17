"use client";

import { useTenant } from "./TenantContext";
import { Logo } from "./Logo";

// The brand lockup in app chrome (headers). On a tenant host with an uploaded
// logo it renders that image; otherwise it falls back to the book mark plus the
// tenant's display name (or "My Course" on the default site). One place so every
// header stays consistent as tenants gain/lose a logo asset.
export function Brand({ className }: { className?: string }) {
  const tenant = useTenant();
  if (tenant?.logoUrl) {
    // A logo "slot" rather than a fixed height: tenant logos vary wildly in aspect
    // (yknot ~2.6:1 horizontal, YWAM ~7:1 banner, Almighty Warriors ~1:1 stacked).
    // Cap both height and width and object-contain so a square/stacked lockup fills
    // the height (legible) while a wide banner is clamped by width instead of
    // rendering as a tiny sliver. eslint-disable: Convex storage URL, not a static asset.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={tenant.logoUrl}
        alt={tenant.displayName}
        className={className ?? "h-12 w-auto max-w-48 object-contain"}
      />
    );
  }
  return (
    <span className="flex items-center gap-2">
      <Logo className="h-8 w-8 text-accent" />
      <span className="text-lg font-semibold tracking-tight text-accent">{tenant?.displayName ?? "My Course"}</span>
    </span>
  );
}
