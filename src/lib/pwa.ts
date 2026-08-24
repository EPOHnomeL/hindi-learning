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

// What one App Icon render needs: an opaque paper square, the source candidates
// in fallback order (Logo, then Favicon; empty means the shipped /icon.svg
// mark), and the object-contain box the source is centred in. 80% leaves a 7:1
// banner readable padding; maskable drops to 60% so Android's circular crop
// can't eat it. A LIST because being uploaded is not enough: the route must
// also skip any candidate satori can't decode (see satoriImageType).
export function appIconSpec(tenant: PwaTenant, { size, maskable }: { size: number; maskable: boolean }) {
  return {
    size,
    background: pwaThemeColor(tenant),
    sources: [tenant?.logoUrl, tenant?.faviconUrl].filter((u): u is string => u != null),
    box: Math.round(size * (maskable ? 0.6 : 0.8)),
  };
}

// Which content type these bytes are, IF satori (next/og) can decode it, else
// null. Sniffed from magic bytes, never trusted from a header. The one that
// bites: assertEmblemImage accepts webp uploads and the branding script even
// recommends them, but satori cannot decode webp and renders the <img> as
// NOTHING, silently: YWAM's first prod app icon was a bare paper square
// (2026-08-24). A webp candidate must fall through to the next source.
export function satoriImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/gif" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return null;
}
