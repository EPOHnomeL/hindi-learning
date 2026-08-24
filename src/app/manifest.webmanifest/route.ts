import { getTenantView } from "~/lib/tenant-server";
import { buildManifest } from "~/lib/pwa";

// The per-tenant web app manifest (installable-app ticket 01). A route handler,
// NOT Next's app/manifest.ts convention: that is statically generated at build
// time and cannot vary by Host, which is the one thing this must do (ADR 0030).
// getTenantView() already degrades to null on an unseeded host or Convex error,
// so the apex and a broken read both get the valid default-site manifest.
//
// The middleware matcher skips dotted paths, so no x-tenant-slug header is
// stamped here; getTenantSlug falls back to parsing Host directly, which is why
// this resolves the tenant correctly anyway.
export async function GET() {
  const tenant = await getTenantView();
  return new Response(JSON.stringify(buildManifest(tenant)), {
    headers: {
      "Content-Type": "application/manifest+json",
      // Branding, not access control: an hour of staleness after a repaint is fine.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
