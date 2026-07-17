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
    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, not a static asset
    return <img src={tenant.logoUrl} alt={tenant.displayName} className={className ?? "h-8 w-auto"} />;
  }
  return (
    <span className="flex items-center gap-2">
      <Logo className="h-8 w-8 text-accent" />
      <span className="text-lg font-semibold tracking-tight text-accent">{tenant?.displayName ?? "My Course"}</span>
    </span>
  );
}
