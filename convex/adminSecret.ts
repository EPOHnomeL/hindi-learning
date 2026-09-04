// The shared-secret admin guard. (Plain module, no Convex functions registered
// here.) Split out of `edition.ts` (then `lib.ts`) by technical-foundation/16: a PUBLISH_SECRET check
// is not part of the Edition access stack, and its nine callers are spread across
// the write paths rather than the reader.

// Guards the PUBLISH_SECRET-protected mutations the teach CLI / cloud agent call.
export function assertAdmin(secret: string) {
  const expected = process.env.PUBLISH_SECRET;
  if (!expected || secret !== expected) throw new Error("unauthorized");
}
