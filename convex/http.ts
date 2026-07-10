import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";

// Mounts Convex Auth's HTTP routes (sign-in/up, token refresh, etc.).
const http = httpRouter();
auth.addHttpRoutes(http);

// NOTE (PayFast pivot, .scratch/payfast-payments): the Stripe webhook that lived
// here is gone. Its replacement — the verified PayFast ITN at /payfast/notify,
// the sole grantor of paid access — lands with ticket 04.

// Serve a **content blob** (a Lesson / Reference / translated body, see
// .scratch/html-blob-storage) by its storageId. The storageId is an unguessable
// bearer capability minted into the URL only for callers a reader query has
// already authorized — this route does no per-request auth (matching the
// existing `resources` / `emblem` bearer URLs), which is what lets the response
// be cached hard. Content is immutable per storageId, so we serve it `immutable`
// with a one-year max-age; a superseding body gets a new storageId → new URL.
http.route({
  path: "/content",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    let blob: Blob | null = null;
    try {
      if (id) blob = await ctx.storage.get(id as Id<"_storage">);
    } catch {
      blob = null; // malformed id → treat as missing
    }
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        // Bearer capability, not user-scoped — safe to serve to any origin, and
        // the reader `fetch`es it cross-origin from the web app.
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
