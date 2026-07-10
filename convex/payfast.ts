// PayFast (South Africa) — the pure payments module (.scratch/payfast-payments).
// No "use node", no network, no ctx: everything here is deterministic — the
// inline MD5 (Convex's Web-Crypto has none), PayFast's signature scheme, the
// checkout field builder, the 50/50 net-split math, ZAR formatting, and the
// sandbox/live gateway URLs. The ONE network call on the rail (the ITN's server
// postback to /eng/query/validate) lives in http.ts, mocked at that boundary.
//
// Provision before the money path runs live:
//   PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE
//   PAYFAST_MODE      — "sandbox" | "live" (anything else ⇒ sandbox, never live)
//   PLATFORM_FEE_BPS  — the platform's share of net, default 5000 (50%)
//   SITE_URL          — the app origin, for return/cancel URLs

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

// Sign a PayFast field set: the NON-EMPTY fields in alphabetical order as
// key=urlencode(value) joined with &, the passphrase appended, MD5'd (lowercase
// hex). Any `signature` field is excluded — this is what it's computed over.
export function signFields(fields: Record<string, string>, passphrase: string): string {
  const canonical = Object.keys(fields)
    .filter((k) => k !== "signature" && fields[k] !== "")
    .sort()
    .map((k) => `${k}=${pfEncode(fields[k]!)}`)
    .join("&");
  return md5(`${canonical}&passphrase=${pfEncode(passphrase)}`);
}

// Whether a field set's `signature` is genuine — the ITN's first verification
// step (http.ts). Absent or mismatched ⇒ forged ⇒ rejected.
export function verifySignature(fields: Record<string, string>, passphrase: string): boolean {
  return !!fields.signature && fields.signature.toLowerCase() === signFields(fields, passphrase);
}

// ---- the checkout field builder --------------------------------------------------

// The signed field set startCheckout returns for the client to form-POST to the
// hosted process URL. `custom_str1/2` carry what the ITN grants (topicId/lang);
// `m_payment_id` is our checkout-intent reference. item_name is capped at
// PayFast's 100-char field limit.
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
    m_payment_id: opts.mPaymentId,
    amount: randFromCents(opts.amountCents),
    item_name: opts.itemName.slice(0, 100),
    email_address: opts.email,
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
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? "5000");
  if (!Number.isFinite(raw) || raw < 0 || raw > 10_000) return 5000;
  return Math.round(raw);
}

// Split a sale's net (cents, from the ITN's amount_net) into the author's and the
// platform's shares (PRD: author = round(net × bps / 10000), remainder platform).
// The shares always sum back to net and never go negative — rounding neither
// loses nor mints a cent, even on a fixed-fee-heavy cheap sale.
export function splitNet(netCents: number, bps: number): { authorShare: number; platformShare: number } {
  const authorShare = Math.round((netCents * bps) / 10_000);
  return { authorShare, platformShare: netCents - authorShare };
}

// ---- ZAR formatting -----------------------------------------------------------------

// Cents → the 2-decimal Rand string PayFast's `amount` fields carry ("1500.00").
// Integer math — no float rounding at the money boundary.
export function randFromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// ---- gateway URLs -----------------------------------------------------------------------

// Sandbox unless PAYFAST_MODE is exactly "live" — a missing/typo'd env var must
// never send a buyer (or a validate postback) to the live gateway.
function gatewayHost(): string {
  return process.env.PAYFAST_MODE === "live" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";
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
export function appUrl(path = "/"): string {
  const base = process.env.SITE_URL;
  if (!base) throw new Error("SITE_URL is not set — provision it as a Convex env var");
  const baseUrl = new URL(base);
  let resolved: URL;
  try {
    resolved = new URL(path, baseUrl);
  } catch {
    return new URL("/", baseUrl).toString();
  }
  if (resolved.origin !== baseUrl.origin) return new URL("/", baseUrl).toString();
  return resolved.toString();
}
