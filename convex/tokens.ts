// Opaque-string primitives: the capability token a link carries, and the cheap
// fingerprint the translator uses to spot a changed source item. (Plain module,
// no Convex functions registered here.) Split out of `edition.ts` (then `lib.ts`) by
// technical-foundation/16: neither has anything to say about Editions or grants.

// A 256-bit URL-safe token (hex) from Web Crypto — the credential a capability
// link carries: a Public link (ADR 0013) or a Certificate link (ADR 0015). Long
// enough that guessing is infeasible, so no rate-limiting is needed.
export function mintToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// A cheap, stable 32-bit string hash (FNV-1a) as hex. Used only to detect
// whether a source item changed since it was last translated (staleness), so a
// re-translate can skip unchanged items — not for security. Synchronous, unlike
// crypto.subtle, so it's usable inside a query/mutation without awaiting.
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
