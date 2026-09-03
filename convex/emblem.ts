import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOwnedTopic } from "./topicAccess";

// The Emblem (ADR 0017): a Topic's representative mark, snapshotted onto each
// Certificate at claim and shown on the card. This module holds the shared Emblem
// logic — resolution, snapshotting, upload validation — plus the owner-set
// mutation. The read seams (certificates.ts) and the AI default (content.ts's
// completeCourse) both lean on these helpers so the fallback rules stay in one
// place.

// The generic fallback when a Topic has no Emblem at all (an owner-ended course
// with no model in the loop, a pre-feature Certificate). A course never shows a
// blank mark (PRD story 3).
export const DEFAULT_EMBLEM_GLYPH = "🎓";

// A glyph is an emoji or short character, not a caption — capped by code points
// so a multi-code-point emoji (flags, ZWJ sequences) still fits while a pasted
// paragraph is refused.
const EMBLEM_GLYPH_MAX_CODEPOINTS = 8;

// Emblem images are size-capped square rasters (ADR 0017): small enough to print
// predictably and to stay cheap on the anonymous page, which serves them
// same-origin. Normalisation happens before upload (teach skill / client); the
// backend only validates type + size.
export const EMBLEM_IMAGE_MAX_BYTES = 256 * 1024;
const ALLOWED_EMBLEM_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// The resolved, read-facing Emblem shape returned by both certificate read seams
// — a discriminated union. This is the one field by which the public output
// allowlist grows (ADR 0017): a same-origin image URL or a short glyph carries no
// email and no Lesson content, so the seam's leak-free guarantee holds.
export const resolvedEmblemValidator = v.union(
  v.object({ kind: v.literal("image"), url: v.string() }),
  v.object({ kind: v.literal("glyph"), glyph: v.string() }),
);

// The stored/frozen Emblem shape (on a Topic, minus `ownerSet`; on a Certificate).
type StoredEmblem = { imageId?: Id<"_storage">; glyph?: string };
export type ResolvedEmblem = { kind: "image"; url: string } | { kind: "glyph"; glyph: string };

// Resolve a stored Emblem to its read shape in the fixed fallback order: a
// resolvable image wins over a glyph wins over the generic default. Never returns
// null — a Certificate always shows *something*. A stored `imageId` whose blob
// somehow failed to resolve falls through to the glyph (Emblem blobs are immutable
// and retained, so in practice it always resolves).
export async function resolveEmblem(ctx: QueryCtx, emblem: StoredEmblem | undefined): Promise<ResolvedEmblem> {
  if (emblem?.imageId) {
    const url = await ctx.storage.getUrl(emblem.imageId);
    if (url) return { kind: "image", url };
  }
  return { kind: "glyph", glyph: emblem?.glyph || DEFAULT_EMBLEM_GLYPH };
}

// The frozen copy captured onto a Certificate at claim — drops `ownerSet` (only a
// write-time precedence marker) and keeps only fields actually present, so an
// empty Emblem snapshots as `undefined` and resolves to the generic default.
export function snapshotEmblem(emblem: Doc<"topics">["emblem"]): StoredEmblem | undefined {
  if (!emblem) return undefined;
  const snap: StoredEmblem = {};
  if (emblem.imageId) snap.imageId = emblem.imageId;
  if (emblem.glyph) snap.glyph = emblem.glyph;
  return snap.imageId || snap.glyph ? snap : undefined;
}

// Trim + length-cap a glyph, or throw. Shared by the owner and AI paths.
export function normaliseGlyph(glyph: string): string {
  const g = glyph.trim();
  if (!g) throw new Error("emblem glyph required");
  if ([...g].length > EMBLEM_GLYPH_MAX_CODEPOINTS) throw new Error("emblem glyph too long");
  return g;
}

// Validate an already-uploaded Emblem image is a size-capped raster, or throw.
// SVG is refused (an XSS vector on the anonymous certificate page — ADR 0017);
// oversize is refused so the card prints predictably. Shared by the owner-set and
// AI-completion paths, both of which feed the same anonymous surface. Mutations
// can't read blob bytes (that's action-only), so this validates metadata, per the
// PRD ("the backend only validates type/size and stores").
//
// Two type signals, both enforced:
//   - `contentType` — what the client declares it uploaded. The only type signal
//     `convex-test` surfaces (it omits the stored contentType), and a fast, clear
//     error before storing a reference.
//   - `meta.contentType` — the type the blob is actually *served* with (`getUrl`
//     uses the stored Content-Type). This is the security-relevant one: an SVG can
//     only execute if served as `image/svg+xml`, so rejecting a non-raster served
//     type closes the XSS vector even if the declared type was spoofed. Absent in
//     the test harness (skipped there); present and authoritative in production.
// Size is checked from cheap metadata, so an over-cap upload is rejected without
// materialising its bytes.
export async function assertEmblemImage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  contentType: string,
): Promise<void> {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) throw new Error("emblem upload not found");
  if (meta.size > EMBLEM_IMAGE_MAX_BYTES) throw new Error("emblem image is too large");
  if (!ALLOWED_EMBLEM_IMAGE_TYPES.has(contentType)) {
    throw new Error("emblem must be a PNG, JPEG, or WebP image");
  }
  if (meta.contentType && !ALLOWED_EMBLEM_IMAGE_TYPES.has(meta.contentType)) {
    throw new Error("emblem must be a PNG, JPEG, or WebP image");
  }
}

// Owner-only: curate a Topic's Emblem (ADR 0017, PRD stories 9-14). The arg is a
// discriminated union — set a glyph, or record an already-uploaded image (the
// client uploads via the existing `resources.generateUploadUrl` flow, then hands
// the reference here). A Viewer or non-owner is refused server-side by the owner
// gate (`getOwnedTopic`), not merely hidden in the UI.
//
// Stamps `ownerSet: true` so the AI default (`completeCourse`) never clobbers the
// owner's choice, regardless of which was written first. Setting one kind clears
// the other (the fixed resolution order means a leftover image would otherwise
// mask a just-set glyph). Emblem blobs are immutable: this records the new
// `imageId` and never deletes the previous one — a Certificate may have frozen it.
export const setTopicEmblem = mutation({
  args: {
    topicSlug: v.string(),
    emblem: v.union(
      v.object({ kind: v.literal("glyph"), glyph: v.string() }),
      v.object({ kind: v.literal("image"), storageId: v.id("_storage"), contentType: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { topicSlug, emblem }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    if (emblem.kind === "glyph") {
      await ctx.db.patch(topic._id, { emblem: { glyph: normaliseGlyph(emblem.glyph), ownerSet: true } });
    } else {
      await assertEmblemImage(ctx, emblem.storageId, emblem.contentType);
      await ctx.db.patch(topic._id, { emblem: { imageId: emblem.storageId, ownerSet: true } });
    }
    return null;
  },
});
