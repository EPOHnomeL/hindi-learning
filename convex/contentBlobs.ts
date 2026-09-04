// Content blobs (see .scratch/html-blob-storage): the read shape of a rendered
// body, the `/content` URL that serves one, and the entity decode every title
// passes through. (Plain module, no Convex functions registered here.) Split out
// of `edition.ts` (then `lib.ts`) by technical-foundation/16: how a body is addressed is independent
// of who may read it.

import type { Id } from "./_generated/dataModel";

// The read shape for a rendered body (Lesson / Reference / translated item): a
// `contentUrl` the client fetches when the body lives in a content blob (all
// source Lessons/References after the narrow step), or an inline `html` string
// for a translated row still stored inline (the translation write-path migration
// is a follow-up). Exactly one is present.
export type ContentBody = { contentUrl: string; html?: undefined } | { contentUrl?: undefined; html: string };

// The absolute URL of the `/content` HTTP route for a stored blob. Built from
// CONVEX_SITE_URL (the deployment's `.convex.site` origin), which Convex injects
// into every function's env. The storageId is an unguessable bearer capability;
// callers only reach this after the query has authorized them.
export function contentUrl(storageId: Id<"_storage">): string {
  const base = process.env.CONVEX_SITE_URL ?? "";
  return `${base}/content?id=${storageId}`;
}

// Resolve a row's body: the `/content` URL for its blob, else an inline `html`
// string (translations still stored inline). Empty inline body when neither.
export function contentBody(row: { htmlStorageId?: Id<"_storage">; html?: string }): ContentBody {
  if (row.htmlStorageId) return { contentUrl: contentUrl(row.htmlStorageId) };
  return { html: row.html ?? "" };
}

// Choose which body to serve for a translatable item: the translated row's when
// it has one (blob or inline html), else the source row's blob (course-translation).
export function pickContentBody(
  translated: { htmlStorageId?: Id<"_storage">; html?: string } | null | undefined,
  source: { htmlStorageId?: Id<"_storage"> },
): ContentBody {
  if (translated && (translated.htmlStorageId || translated.html)) return contentBody(translated);
  return contentBody(source);
}

// Titles are authored upstream from generated HTML and can arrive entity-encoded
// (e.g. "Maps &amp; List"). Decode the handful of named/numeric entities that
// show up in plain-text titles so the UI never renders a raw "&amp;".
// ponytail: covers the common entities; extend the map if a new one appears.
// (Lives beside the content-blob helpers rather than in `edition.ts`, which reads it
// through this module; nothing re-exports it.)
export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e as string] ?? _,
  );
}
