/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { contentBody } from "./contentBlobs";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// The resolver helper: prefer the blob (→ content URL), else the inline body.
test("contentBody prefers a content URL, falling back to inline html", () => {
  const sid = "kg2abc123" as Id<"_storage">;
  expect(contentBody({ htmlStorageId: sid })).toEqual({ contentUrl: `/content?id=${sid}` });
  expect(contentBody({ html: "<p>x</p>" })).toEqual({ html: "<p>x</p>" });
  // A blob wins even if a stale inline body is still present (transition rows).
  expect(contentBody({ htmlStorageId: sid, html: "<p>stale</p>" })).toEqual({ contentUrl: `/content?id=${sid}` });
});

// Seam 2 — the `/content` HTTP route (see .scratch/html-blob-storage). The
// immutable cache + CORS headers are the point of the feature and are only
// observable at the HTTP boundary, so they're asserted here.

test("GET /content streams a stored blob with immutable cache + CORS headers", async () => {
  const t = convexTest(schema, modules);
  const body = "<p>hello lesson</p>";
  const id = await t.run((ctx) => ctx.storage.store(new Blob([body], { type: "text/html" })));

  const res = await t.fetch(`/content?id=${id}`);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe(body);
  expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
});

test("GET /content 404s for a missing storageId", async () => {
  const t = convexTest(schema, modules);
  // A valid-shaped id whose blob no longer exists → null → 404.
  const id = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
  await t.run((ctx) => ctx.storage.delete(id));

  expect((await t.fetch(`/content?id=${id}`)).status).toBe(404);
});

test("GET /content 404s when the id param is absent or malformed", async () => {
  const t = convexTest(schema, modules);
  expect((await t.fetch(`/content`)).status).toBe(404);
  expect((await t.fetch(`/content?id=not-a-real-id`)).status).toBe(404);
});
