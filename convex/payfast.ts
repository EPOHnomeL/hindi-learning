// PayFast (South Africa) — the pure payments module (.scratch/payfast-payments).
// No "use node", no network, no ctx: everything here is deterministic — the
// inline MD5 (Convex's Web-Crypto has none), PayFast's signature scheme, the
// checkout field builder, the 50/50 net-split math, ZAR formatting, and the
// sandbox/live gateway URLs. The ONE network call on the rail (the ITN's server
// postback to /eng/query/validate) lives in http.ts, mocked at that boundary.
//
// Provision before the money path runs live (declared + validated in ./env):
//   PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE
//   PAYFAST_MODE      — "live" | "sandbox" | "off" (off pauses selling)
//   PLATFORM_FEE_BPS  — the platform's share of net, default 5000 (50%)
//   SITE_URL          — the app origin, for return/cancel URLs
import { env } from "./env";

// ---- inline MD5 (RFC 1321) ---------------------------------------------------

// Per-round left-rotate amounts and the sine-derived constants, straight from
// the RFC. K is computed, not transcribed — nothing to mistype.
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Uint32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));

// MD5 of a string's UTF-8 bytes, as lowercase hex — what PayFast signs with.
export function md5(input: string): string {
  const msg = new TextEncoder().encode(input);
  // Pad to 56 mod 64 with 0x80 then zeros, then the 64-bit little-endian bit length.
  const padded = new Uint8Array(Math.ceil((msg.length + 9) / 64) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, (msg.length * 8) >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor((msg.length * 8) / 4294967296), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const sum = (F + A + K[i]! + dv.getUint32(off + g * 4, true)) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((sum << S[i]!) | (sum >>> (32 - S[i]!)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map((n) =>
      [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    )
    .join("");
}

// ---- the signature scheme ------------------------------------------------------

// PHP's urlencode, which PayFast canonicalises with: alphanumerics and -_. kept,
// space as +, everything else (incl. !'()*~) percent-encoded uppercase.
function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

// PayFast's canonical parameter string: key=urlencode(value) pairs joined with
// &, in the ORDER THE FIELDS APPEAR (never sorted — for an outgoing form that's
// PayFast's documented attribute order, for an ITN the order received), with
// any `signature` field excluded. Empty values are kept as `key=` (PayFast's
// own ITN sample includes them); outgoing builders simply never emit empties.
// NOTE: the PRD said "alphabetically-ordered", but PayFast computes and checks
// MD5 over the field order — sorting would make it reject every signature.
// This is also the exact body the ITN postback re-sends to /eng/query/validate.
export function pfParamString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .filter((k) => k !== "signature")
    .map((k) => `${k}=${pfEncode(fields[k]!)}`)
    .join("&");
}

// Sign a PayFast field set: the canonical string above, the passphrase
// appended, MD5'd (lowercase hex).
export function signFields(fields: Record<string, string>, passphrase: string): string {
  return md5(`${pfParamString(fields)}&passphrase=${pfEncode(passphrase)}`);
}

// Whether a field set's `signature` is genuine — the ITN's first verification
// step (http.ts). The fields must be in RECEIVED order (URLSearchParams
// iteration preserves it). Absent or mismatched ⇒ forged ⇒ rejected.
export function verifySignature(fields: Record<string, string>, passphrase: string): boolean {
  return !!fields.signature && fields.signature.toLowerCase() === signFields(fields, passphrase);
}

// Parse a PayFast Rand amount string ("1200.00", "9.9", "-4.60" — the ITN's
// amount_fee arrives negative) into signed integer cents, or null on garbage.
// Integer math; never trusts parseFloat at the money boundary.
export function centsFromRand(amount: string): number | null {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return null;
  const cents = Number(m[2]) * 100 + (m[3] ? Number(m[3].padEnd(2, "0")) : 0);
  return m[1] === "-" ? -cents : cents;
}

// ---- the ITN acceptance rules (architecture-deepening/04) --------------------

// Whether a signature-verified notification may grant access, and the money it
// grants. Three outcomes, because "don't grant" is two different things to
// PayFast: `ignore` acknowledges a genuine notification there is nothing to do
// about (so it stops re-sending), `refuse` rejects one that must never grant.
// The accepted notification hands back the very intent it was matched against, so
// the caller reads what to grant (topic/lang/buyer) off a value the rules have
// already vouched for — there is no second, unguarded `if (!intent)` at the call
// site, and no way to dispatch on a `grant` without one.
export type ItnAcceptance<T> =
  | { outcome: "grant"; payment: { pfPaymentId: string; gross: number; fee: number; net: number }; intent: T }
  | { outcome: "ignore" }
  | { outcome: "refuse"; reason: string };

// THE money-acceptance decision for a PayFast ITN — the rules that used to sit
// inline in `http.ts`'s payfastNotify, where they were reachable only through the
// mocked-fetch harness. Pure: the caller has already verified the signature and
// looked up the checkout-intent this `m_payment_id` names (null when there is
// none); the network postback happens after, on `grant`.
//
// In order, cheapest and most-certain first:
//   1. only a COMPLETE payment grants — anything else is acknowledged and dropped;
//   2. the notification must parse (both references present, all three amounts
//      well-formed Rand) — integer cents, never parseFloat at the money boundary;
//   3. it must answer a Buy click of ours — no intent ⇒ not from our checkout;
//   4. the paid amount must equal the price FROZEN on that intent — what was
//      listed when the buyer clicked Buy. A tampered/cheap payment never unlocks
//      a dearer Edition, and a re-price or un-list after Buy never strands a
//      genuine payment: once they've paid what was asked, they own it.
// The fee is normalised to positive here (PayFast sends it negative), so the
// ledger's caller never has to remember to.
export function acceptNotification<T extends { amount: number }>(
  fields: Record<string, string>,
  intent: T | null,
): ItnAcceptance<T> {
  if (fields.payment_status !== "COMPLETE") return { outcome: "ignore" };

  const pfPaymentId = fields.pf_payment_id;
  const gross = centsFromRand(fields.amount_gross ?? "");
  const fee = centsFromRand(fields.amount_fee ?? "");
  const net = centsFromRand(fields.amount_net ?? "");
  if (!pfPaymentId || !fields.m_payment_id || gross === null || fee === null || net === null) {
    return { outcome: "refuse", reason: "malformed notification" };
  }

  if (!intent) return { outcome: "refuse", reason: "unknown payment reference" };
  if (intent.amount !== gross) return { outcome: "refuse", reason: "amount mismatch" };

  return { outcome: "grant", payment: { pfPaymentId, gross, fee: Math.abs(fee), net }, intent };
}

// ---- the checkout field builder --------------------------------------------------

// The signed field set startCheckout returns for the client to form-POST to the
// hosted process URL. `custom_str1/2` carry what the ITN grants (topicId/lang);
// `m_payment_id` is our checkout-intent reference. item_name is capped at
// PayFast's 100-char field limit. Field order below IS the signature order
// (PayFast's documented attribute order: merchant → buyer → transaction).
export function buildCheckoutFields(opts: {
  merchantId: string;
  merchantKey: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  mPaymentId: string;
  amountCents: number;
  itemName: string;
  email: string;
  topicId: string;
  lang: string;
  passphrase: string;
}): Record<string, string> {
  const fields: Record<string, string> = {
    merchant_id: opts.merchantId,
    merchant_key: opts.merchantKey,
    return_url: opts.returnUrl,
    cancel_url: opts.cancelUrl,
    notify_url: opts.notifyUrl,
    email_address: opts.email,
    m_payment_id: opts.mPaymentId,
    amount: randFromCents(opts.amountCents),
    item_name: opts.itemName.slice(0, 100),
    custom_str1: opts.topicId,
    custom_str2: opts.lang,
  };
  return { ...fields, signature: signFields(fields, opts.passphrase) };
}

// ---- the 50/50 net split ----------------------------------------------------------

// The platform's share of each sale's NET, in basis points. Config, not
// architecture: the operator chose 50% (PLATFORM_FEE_BPS=5000). Defaults to 5000
// so a missing env var doesn't silently zero either side; bounded to [0, 10000]
// so a stray value can't invert the economics.
export function platformFeeBps(): number {
  return env().PLATFORM_FEE_BPS;
}

// Split a sale's net (cents, from the ITN's amount_net) into the Seller's and
// the platform's shares. The bps is the PLATFORM's cut — its name, and the
// prior rail's convention (1500 meant a 15% platform take-rate); the PRD's
// literal formula handed the bps to the seller, which at the decided 5000 is
// identical but at any other value inverts the economics, so the name wins.
// The shares always sum back to net and never go negative — rounding neither
// loses nor mints a cent, even on a fixed-fee-heavy cheap sale.
export function splitNet(netCents: number, bps: number): { sellerShare: number; platformShare: number } {
  const platformShare = Math.round((netCents * bps) / 10_000);
  return { sellerShare: netCents - platformShare, platformShare };
}

// ---- ZAR formatting -----------------------------------------------------------------

// Cents → the 2-decimal Rand string PayFast's `amount` fields carry ("1500.00").
// Integer math — no float rounding at the money boundary.
export function randFromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// ---- gateway URLs -----------------------------------------------------------------------

// Whether the PayFast rail is configured — the merchant credentials + passphrase
// every signed checkout needs. Selling (pricing an Edition) is disabled until
// they exist, so a listing checkout can't sell never comes into being; the env
// is read at call time, so provisioning the vars enables selling by itself.
export function payfastConfigured(): boolean {
  const e = env();
  return !!(e.PAYFAST_MERCHANT_ID && e.PAYFAST_MERCHANT_KEY && e.PAYFAST_PASSPHRASE);
}

// The deployment's PayFast mode — the single value gating both the gateway host
// and whether selling is live. One of "live" | "sandbox" | "off" (off pauses
// selling platform-wide, credentials left in place). Declared, validated, and
// defaulted in ./env: unset ⇒ sandbox (never live); any other value throws there.
export function payfastMode(): "live" | "sandbox" | "off" {
  return env().PAYFAST_MODE;
}

// Whether selling is paused platform-wide — PAYFAST_MODE=off. The pause turns
// selling off WITHOUT tearing down the merchant credentials — the state to reach
// for while the PayFast merchant account is blocked. Independent of provisioning.
export function sellingDisabled(): boolean {
  return payfastMode() === "off";
}

// Whether selling is live on this deployment: the rail is provisioned AND not
// paused. The single gate the Seller controls and the checkout consult — content
// access is deliberately independent of it (a listing's presence alone gates
// reads, so a pause never strands a bought Edition).
export function sellingEnabled(): boolean {
  return payfastConfigured() && !sellingDisabled();
}

// The gateway host for the current mode — the live host only for "live", the
// sandbox host for "sandbox"/"off". A missing/typo'd mode can't reach here: it
// either defaults to sandbox or throws in payfastMode, so a buyer (or a validate
// postback) is never sent to the live gateway by accident.
function gatewayHost(): string {
  return payfastMode() === "live" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";
}
// The hosted checkout the client form-POSTs the signed fields to.
export function processUrl(): string {
  return `${gatewayHost()}/eng/process`;
}
// The server postback that confirms an ITN really came from PayFast.
export function validateUrl(): string {
  return `${gatewayHost()}/eng/query/validate`;
}

// ---- app URLs (moved from stripe.ts, behaviour unchanged) ---------------------------------

// The app origin PayFast's hosted flow returns to. `path` may be client-supplied
// (a return path), so this ENFORCES same-origin: a value that resolves off the
// trusted SITE_URL origin — an absolute `https://evil.com`, a protocol-relative
// `//evil.com` — is discarded for the origin root, closing the open-redirect
// that would otherwise flow into PayFast's return/cancel URLs.
export function appUrl(path = "/", tenantSlug?: string): string {
  const base = env().SITE_URL;
  if (!base) throw new Error("SITE_URL is not set — provision it as a Convex env var");
  const baseUrl = new URL(base);
  // A tenant course's server-built links ride its own subdomain — `<slug>.<base>`,
  // where `base` is SITE_URL's host minus a leading `www` (issue 12 / ADR 0021 §3).
  // No slug = the default site, and a dot-less host (localhost) has no room for a
  // subdomain — both keep SITE_URL verbatim. `tenantSlug` is a trusted topic column
  // (never client input), so the same-origin guard below implicitly bounds the set
  // to { SITE_URL } ∪ { <slug>.<base> } — no allow-list needed.
  if (tenantSlug && baseUrl.hostname.includes(".")) {
    baseUrl.hostname = `${tenantSlug}.${baseUrl.hostname.replace(/^www\./, "")}`;
  }
  let resolved: URL;
  try {
    resolved = new URL(path, baseUrl);
  } catch {
    return new URL("/", baseUrl).toString();
  }
  if (resolved.origin !== baseUrl.origin) return new URL("/", baseUrl).toString();
  return resolved.toString();
}
