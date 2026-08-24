import { ImageResponse } from "next/og";
import { getTenantView } from "~/lib/tenant-server";
import { appIconSpec } from "~/lib/pwa";

// The derived App Icon (installable-app ticket 01, ADR 0030 §2): the tenant's
// Logo contained in a padded box, centred on an OPAQUE square of its own paper.
// Opaque is not cosmetic: iOS renders any transparency as solid black. Rendered
// by ImageResponse (satori) at request time, so no new dependency and no
// per-tenant design chore; tenant logos are raster only (assertEmblemImage
// refuses SVG), which satori handles.
//
// Sizes come from the query string (?size=192|512|180, &maskable=1) because the
// manifest needs distinct URLs per variant and four route files would say the
// same thing. A wide banner (YWAM ~7:1) is EXPECTED to read as a wide logo in a
// coloured square; do not "fix" it by cropping (ADR 0030 §2).
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Clamp so a hostile ?size=9999 can't make this render arbitrary bitmaps.
  const size = Math.min(1024, Math.max(48, Number(url.searchParams.get("size")) || 512));
  const maskable = url.searchParams.get("maskable") === "1";

  const tenant = await getTenantView();
  const spec = appIconSpec(tenant, { size, maskable });
  // Fallback of last resort: the shipped mark, fetched off this same host
  // because satori wants an absolute URL and fs paths don't survive Vercel.
  const src = spec.src ?? new URL("/icon.svg", url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: spec.background,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori element, not DOM */}
        <img src={src} width={spec.box} height={spec.box} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    {
      width: spec.size,
      height: spec.size,
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
