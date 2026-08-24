// The pure seams behind the installable app (installable-app ticket 01): what
// the manifest route and the App Icon route serve, derived from the same
// getTenantView() result the root layout already reads. Pure so pwa.test.ts can
// pin them; the route handlers stay thin wrappers.

// The slice of getTenantView() these seams read. `null` is the default site AND
// the degrade path (unseeded host, Convex error): both get the shipped identity.
export type PwaTenant = {
  displayName: string;
  theme: { light: Record<string, string> };
  logoUrl: string | null;
  faviconUrl: string | null;
} | null;

// The shipped light palette's paper, duplicated from src/styles/globals.css
// (--color-paper) because CSS isn't importable from here.
const DEFAULT_PAPER = "#fbf7f0";
const DEFAULT_NAME = "My Course";

// Paper (not accent) everywhere a platform colour is asked for: the Logo already
// renders on paper in the app header, so legibility on it is a property the brand
// has proven, and the splash/title bar blend into the page instead of shouting.
export function pwaThemeColor(tenant: PwaTenant): string {
  return tenant?.theme.light.paper ?? DEFAULT_PAPER;
}

export function buildManifest(tenant: PwaTenant) {
  const name = tenant?.displayName ?? DEFAULT_NAME;
  return {
    name,
    short_name: name,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone" as const,
    theme_color: pwaThemeColor(tenant),
    background_color: pwaThemeColor(tenant),
    icons: [
      { src: "/app-icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon?size=512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

// What one App Icon render needs: an opaque paper square, the best source image
// (Logo, else Favicon, else null meaning the shipped /icon.svg mark), and the
// object-contain box the source is centred in. 80% leaves a 7:1 banner readable
// padding; maskable drops to 60% so Android's circular crop can't eat it.
export function appIconSpec(tenant: PwaTenant, { size, maskable }: { size: number; maskable: boolean }) {
  return {
    size,
    background: pwaThemeColor(tenant),
    src: tenant?.logoUrl ?? tenant?.faviconUrl ?? null,
    box: Math.round(size * (maskable ? 0.6 : 0.8)),
  };
}
